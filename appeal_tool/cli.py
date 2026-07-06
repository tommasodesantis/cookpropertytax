from __future__ import annotations

import argparse
import os
from datetime import date, datetime
from pathlib import Path

from appeal_tool.analysis import build_evidence_summary
from appeal_tool.config import DEFAULT_TAX_RATE
from appeal_tool.errors import AppealToolError, UserInputError
from appeal_tool.models import UserEvidence
from appeal_tool.pdf import write_packet
from appeal_tool.pin import normalize_pin
from appeal_tool.reporting import console_report, json_summary
from appeal_tool.repository import FixtureRepository, SocrataClient, SocrataRepository
from appeal_tool.routing import route_case


def _parse_date(value: str | None, field_name: str) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise UserInputError(f"{field_name} must be YYYY-MM-DD.") from exc


def _positive_float(value: str | None, field_name: str) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except ValueError as exc:
        raise UserInputError(f"{field_name} must be a positive number.") from exc
    if parsed <= 0:
        raise UserInputError(f"{field_name} must be a positive number.")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="appeal_tool.py",
        description="Cook County residential property-tax appeal assistant.",
    )
    subject = parser.add_mutually_exclusive_group(required=True)
    subject.add_argument("--pin", help="Cook County PIN, formatted or unformatted.")
    subject.add_argument("--address", help="Address search text.")
    parser.add_argument("--select-address", type=int, help="1-based address match to use.")
    parser.add_argument("--venue", choices=["auto", "assessor", "bor", "ptab"], default="auto")
    parser.add_argument("--bor-decision-date", help="BOR written decision date, YYYY-MM-DD.")
    parser.add_argument("--bor-decision-av", help="BOR decision assessed value.")
    parser.add_argument("--assessor-appeal-filed", action="store_true")
    parser.add_argument("--purchase-price")
    parser.add_argument("--purchase-date")
    parser.add_argument("--appraisal-value")
    parser.add_argument("--appraisal-date")
    parser.add_argument("--condition-issue", action="append", default=[])
    parser.add_argument("--actual-sqft")
    parser.add_argument(
        "--ownership-type",
        choices=["individual", "llc", "corporation", "other"],
        default="individual",
    )
    parser.add_argument("--owner-occupied", action="store_true")
    parser.add_argument("--age-65-plus", action="store_true")
    parser.add_argument("--senior-freeze-income", action="store_true")
    parser.add_argument("--veteran-disabled", action="store_true")
    parser.add_argument("--person-disabled", action="store_true")
    parser.add_argument("--vacancy-claim", action="store_true")
    parser.add_argument("--demolition-claim", action="store_true")
    parser.add_argument("--tax-rate", default=str(DEFAULT_TAX_RATE))
    parser.add_argument("--output-dir", default=".")
    parser.add_argument("--json", action="store_true", help="Print machine-readable case summary.")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--no-pdf", action="store_true")
    parser.add_argument("--fixture-dir", help="Offline fixture directory for deterministic runs.")
    parser.add_argument("--today", help=argparse.SUPPRESS)
    return parser


def _user_evidence_from_args(args: argparse.Namespace) -> UserEvidence:
    return UserEvidence(
        purchase_price=_positive_float(args.purchase_price, "--purchase-price"),
        purchase_date=_parse_date(args.purchase_date, "--purchase-date"),
        appraisal_value=_positive_float(args.appraisal_value, "--appraisal-value"),
        appraisal_date=_parse_date(args.appraisal_date, "--appraisal-date"),
        condition_issues=tuple(args.condition_issue or ()),
        ownership_type=args.ownership_type,
        owner_occupied=True if args.owner_occupied else None,
        age_65_plus=True if args.age_65_plus else None,
        household_income_below_65k=True if args.senior_freeze_income else None,
        veteran_disabled=True if args.veteran_disabled else None,
        person_disabled=True if args.person_disabled else None,
        vacancy_claim=bool(args.vacancy_claim),
        demolition_claim=bool(args.demolition_claim),
        assessor_appeal_filed=bool(args.assessor_appeal_filed),
        actual_sqft=_positive_float(args.actual_sqft, "--actual-sqft"),
    )


def _repository(args: argparse.Namespace) -> FixtureRepository | SocrataRepository:
    if args.fixture_dir:
        return FixtureRepository(Path(args.fixture_dir))
    return SocrataRepository(SocrataClient(no_cache=bool(args.no_cache)))


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        today = _parse_date(args.today or os.getenv("APPEAL_TOOL_TODAY"), "--today") or date.today()
        tax_rate = _positive_float(args.tax_rate, "--tax-rate") or DEFAULT_TAX_RATE
        repo = _repository(args)
        if args.pin:
            pin = normalize_pin(args.pin)
            case = repo.load_case_by_pin(pin)
        else:
            matches = repo.lookup_address(args.address)
            if not matches:
                raise UserInputError(
                    "No address matches found. Try a PIN or a more specific address."
                )
            if len(matches) > 1:
                if args.select_address is None:
                    print("Ambiguous address. Re-run with --select-address N:")
                    for index, match in enumerate(matches[:10], start=1):
                        print(
                            f"{index}. {match.pin_formatted} | {match.address} | "
                            f"{match.township_name} | class {match.property_class}"
                        )
                    return 2
                if args.select_address < 1 or args.select_address > len(matches):
                    raise UserInputError("--select-address is outside the match list.")
                selected = matches[args.select_address - 1]
            else:
                selected = matches[0]
            case = repo.load_case_by_pin(selected.pin)

        case = case.with_user_evidence(_user_evidence_from_args(args))
        bor_decision_date = _parse_date(args.bor_decision_date, "--bor-decision-date")
        route = route_case(
            case.parcel.township_name,
            today=today,
            requested_venue=args.venue,
            bor_decision_date=bor_decision_date,
        )
        if route.action_status == "needs_input":
            print(console_report(case, build_evidence_summary(case, tax_rate), route, None))
            return 2

        evidence = build_evidence_summary(case, tax_rate)
        pdf_path = None
        if not args.no_pdf:
            pdf_path = write_packet(case, evidence, route, Path(args.output_dir))
        if args.json:
            print(json_summary(case, evidence, route, pdf_path))
        else:
            print(console_report(case, evidence, route, pdf_path))
        return 0 if route.action_status != "expired" else 1
    except AppealToolError as exc:
        print(f"Input error: {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
