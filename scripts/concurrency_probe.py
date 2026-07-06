from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path
from statistics import median
from typing import Any

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from appeal_tool.config import ASSESSMENT_YEAR  # noqa: E402
from appeal_tool.errors import DataAccessError  # noqa: E402
from appeal_tool.repository import DATASETS, SOCRATA_DOMAIN, SocrataClient  # noqa: E402


@dataclass(frozen=True)
class SampleCase:
    label: str
    pin: str
    township_code: str
    property_class: str


@dataclass(frozen=True)
class HttpEvent:
    status_code: int | None
    error: str | None
    duration_ms: float


@dataclass(frozen=True)
class OperationResult:
    label: str
    ok: bool
    row_count: int
    duration_ms: float
    attempts: int
    statuses: tuple[str, ...]
    error: str | None


@dataclass(frozen=True)
class UserResult:
    mode: str
    concurrency: int
    user_index: int
    pin: str
    ok: bool
    duration_ms: float
    operations: tuple[OperationResult, ...]


@dataclass(frozen=True)
class LevelResult:
    mode: str
    concurrency: int
    users: tuple[UserResult, ...]
    elapsed_seconds: float
    stop_reason: str | None


SAMPLE_CASES = (
    SampleCase("north suburban single-family", "01011000250000", "10", "203"),
    SampleCase("northwest suburban single-family", "03012040020000", "38", "203"),
    SampleCase("north suburban multi-family", "05333120030000", "17", "211"),
    SampleCase("west suburban single-family", "16191010090000", "11", "203"),
    SampleCase("city north multi-family", "14051000240000", "73", "211"),
    SampleCase("city south single-family", "20021020050000", "70", "203"),
    SampleCase("city northwest single-family", "09253030250000", "71", "203"),
    SampleCase("southwest suburban single-family", "19061010050000", "36", "203"),
)

TRANSIENT_STATUS_CODES = {"429", "500", "502", "503", "504"}


class InstrumentedSession:
    def __init__(self) -> None:
        self._session = requests.Session()
        self.events: list[HttpEvent] = []

    def get(self, *args: Any, **kwargs: Any) -> requests.Response:
        started = time.perf_counter()
        try:
            response = self._session.get(*args, **kwargs)
        except requests.RequestException as exc:
            self.events.append(
                HttpEvent(
                    status_code=None,
                    error=exc.__class__.__name__,
                    duration_ms=(time.perf_counter() - started) * 1000.0,
                )
            )
            raise
        self.events.append(
            HttpEvent(
                status_code=response.status_code,
                error=None,
                duration_ms=(time.perf_counter() - started) * 1000.0,
            )
        )
        return response


@contextmanager
def _token_context(mode: str, original_token: str | None) -> Any:
    previous = os.environ.get("SOCRATA_APP_TOKEN")
    if mode == "no_token":
        os.environ.pop("SOCRATA_APP_TOKEN", None)
    elif original_token:
        os.environ["SOCRATA_APP_TOKEN"] = original_token
    try:
        yield
    finally:
        if previous is None:
            os.environ.pop("SOCRATA_APP_TOKEN", None)
        else:
            os.environ["SOCRATA_APP_TOKEN"] = previous


def _make_client(args: argparse.Namespace) -> tuple[SocrataClient, InstrumentedSession]:
    session = InstrumentedSession()
    client = SocrataClient(
        cache_dir=Path(args.cache_dir),
        no_cache=True,
        timeout_seconds=args.timeout,
        max_retries=args.max_retries,
        page_size=args.page_size,
    )
    client.session = session  # type: ignore[assignment]
    return client, session


def _status_labels(events: list[HttpEvent]) -> tuple[str, ...]:
    labels = []
    for event in events:
        if event.status_code is not None:
            labels.append(str(event.status_code))
        else:
            labels.append(f"error:{event.error or 'unknown'}")
    return tuple(labels)


def _operation(
    label: str,
    client: SocrataClient,
    session: InstrumentedSession,
    fetch: Any,
) -> OperationResult:
    started = time.perf_counter()
    event_start = len(session.events)
    try:
        rows = fetch()
        events = session.events[event_start:]
        return OperationResult(
            label=label,
            ok=True,
            row_count=len(rows),
            duration_ms=(time.perf_counter() - started) * 1000.0,
            attempts=len(events),
            statuses=_status_labels(events),
            error=None,
        )
    except DataAccessError as exc:
        events = session.events[event_start:]
        return OperationResult(
            label=label,
            ok=False,
            row_count=0,
            duration_ms=(time.perf_counter() - started) * 1000.0,
            attempts=len(events),
            statuses=_status_labels(events),
            error=f"{exc.kind.value}: {exc}",
        )


def _case_load(
    mode: str, concurrency: int, user_index: int, case: SampleCase, args: argparse.Namespace
) -> UserResult:
    client, session = _make_client(args)
    started = time.perf_counter()
    where = f"township_code='{case.township_code}' AND class='{case.property_class}'"
    year_where = f"{where} AND year='{ASSESSMENT_YEAR}'"
    pin_where = f"pin='{case.pin}'"
    operations = (
        _operation(
            "subject_parcel",
            client,
            session,
            lambda: (
                client.fetch_all(
                    "parcel_universe",
                    {"$where": f"{pin_where} AND year='{ASSESSMENT_YEAR}'"},
                ).rows
            ),
        ),
        _operation(
            "subject_characteristics",
            client,
            session,
            lambda: (
                client.fetch_all(
                    "res_characteristics",
                    {"$where": f"{pin_where} AND year='{ASSESSMENT_YEAR}'"},
                ).rows
            ),
        ),
        _operation(
            "subject_assessed_values",
            client,
            session,
            lambda: client.fetch_all("assessed_values", {"$where": pin_where}).rows,
        ),
        _operation(
            "subject_sales",
            client,
            session,
            lambda: client.fetch_all("parcel_sales", {"$where": pin_where}).rows,
        ),
        _operation(
            "comparable_characteristics_page",
            client,
            session,
            lambda: client._fetch_page(
                "res_characteristics",
                {
                    "$where": year_where,
                    "$order": "pin",
                    "$limit": str(args.context_limit),
                    "$offset": "0",
                },
            ),
        ),
        _operation(
            "comparable_universe_page",
            client,
            session,
            lambda: client._fetch_page(
                "parcel_universe",
                {
                    "$where": year_where,
                    "$order": "pin",
                    "$limit": str(args.context_limit),
                    "$offset": "0",
                },
            ),
        ),
        _operation(
            "comparable_assessed_values_page",
            client,
            session,
            lambda: client._fetch_page(
                "assessed_values",
                {
                    "$where": where,
                    "$order": "pin",
                    "$limit": str(args.context_limit),
                    "$offset": "0",
                },
            ),
        ),
    )
    return UserResult(
        mode=mode,
        concurrency=concurrency,
        user_index=user_index,
        pin=case.pin,
        ok=all(operation.ok for operation in operations),
        duration_ms=(time.perf_counter() - started) * 1000.0,
        operations=operations,
    )


def _run_level(mode: str, concurrency: int, args: argparse.Namespace) -> LevelResult:
    started = time.perf_counter()
    users: list[UserResult] = []
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = []
        for user_index in range(concurrency):
            case = SAMPLE_CASES[user_index % len(SAMPLE_CASES)]
            futures.append(
                executor.submit(_case_load, mode, concurrency, user_index + 1, case, args)
            )
        for future in as_completed(futures):
            users.append(future.result())
    users.sort(key=lambda item: item.user_index)
    stop_reason = _stop_reason(concurrency, users)
    return LevelResult(
        mode=mode,
        concurrency=concurrency,
        users=tuple(users),
        elapsed_seconds=time.perf_counter() - started,
        stop_reason=stop_reason,
    )


def _all_operations(users: tuple[UserResult, ...]) -> list[OperationResult]:
    return [operation for user in users for operation in user.operations]


def _status_counts(users: tuple[UserResult, ...]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for operation in _all_operations(users):
        counts.update(operation.statuses)
    return counts


def _stop_reason(concurrency: int, users: list[UserResult]) -> str | None:
    operations = _all_operations(tuple(users))
    statuses = _status_counts(tuple(users))
    request_count = sum(statuses.values())
    throttle_count = statuses["429"]
    failure_count = sum(1 for operation in operations if not operation.ok)
    user_failures = sum(1 for user in users if not user.ok)
    server_errors = sum(statuses[str(code)] for code in (500, 502, 503, 504))
    if throttle_count >= 2:
        return f"stopped after {throttle_count} HTTP 429 responses"
    if request_count and throttle_count / request_count >= 0.05:
        return f"stopped after {throttle_count}/{request_count} HTTP 429 responses"
    if user_failures >= max(1, concurrency // 2):
        return f"stopped after {user_failures}/{concurrency} simulated users failed"
    if failure_count >= max(2, len(operations) // 5):
        return f"stopped after {failure_count}/{len(operations)} operations failed"
    if request_count and server_errors / request_count >= 0.10:
        return f"stopped after {server_errors}/{request_count} transient server errors"
    return None


def _pct(part: int | float, whole: int | float) -> float:
    return 0.0 if whole == 0 else 100.0 * float(part) / float(whole)


def _p95(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(math_ceil(0.95 * len(ordered)) - 1))
    return ordered[index]


def math_ceil(value: float) -> int:
    integer = int(value)
    return integer if integer == value else integer + 1


def _level_summary(level: LevelResult) -> dict[str, object]:
    operations = _all_operations(level.users)
    statuses = _status_counts(level.users)
    operation_durations = [operation.duration_ms for operation in operations]
    user_durations = [user.duration_ms for user in level.users]
    request_count = sum(statuses.values())
    successful_operations = sum(1 for operation in operations if operation.ok)
    retry_successes = sum(
        1
        for operation in operations
        if operation.ok and any(status in TRANSIENT_STATUS_CODES for status in operation.statuses)
    )
    return {
        "mode": level.mode,
        "concurrency": level.concurrency,
        "elapsed_seconds": round(level.elapsed_seconds, 2),
        "users_ok": sum(1 for user in level.users if user.ok),
        "users_total": len(level.users),
        "operations_ok": successful_operations,
        "operations_total": len(operations),
        "operation_success_pct": round(_pct(successful_operations, len(operations)), 1),
        "http_requests": request_count,
        "status_counts": dict(sorted(statuses.items())),
        "http_429": statuses["429"],
        "retry_successes": retry_successes,
        "median_user_ms": round(median(user_durations), 1) if user_durations else 0.0,
        "p95_user_ms": round(_p95(user_durations), 1),
        "median_operation_ms": round(median(operation_durations), 1)
        if operation_durations
        else 0.0,
        "p95_operation_ms": round(_p95(operation_durations), 1),
        "stop_reason": level.stop_reason,
    }


def _practical_ceiling(levels: list[LevelResult]) -> int:
    ceiling = 0
    for level in levels:
        summary = _level_summary(level)
        if (
            summary["users_ok"] == summary["users_total"]
            and summary["operations_ok"] == summary["operations_total"]
            and summary["http_429"] == 0
            and float(summary["p95_user_ms"]) <= 60_000.0
        ):
            ceiling = max(ceiling, level.concurrency)
    return ceiling


def _run_mode(mode: str, levels: list[int], args: argparse.Namespace) -> list[LevelResult]:
    mode_results: list[LevelResult] = []
    for index, concurrency in enumerate(levels):
        result = _run_level(mode, concurrency, args)
        mode_results.append(result)
        if result.stop_reason:
            break
        if index < len(levels) - 1:
            time.sleep(args.pause_seconds)
    return mode_results


def _write_json(
    path: Path,
    run_date: date,
    token_available: bool,
    levels: list[LevelResult],
) -> None:
    payload = {
        "run_date": run_date.isoformat(),
        "assessment_year": ASSESSMENT_YEAR,
        "socrata_domain": SOCRATA_DOMAIN,
        "datasets": DATASETS,
        "app_token_available": token_available,
        "token_value_recorded": False,
        "levels": [asdict(level) for level in levels],
        "summaries": [_level_summary(level) for level in levels],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _write_report(
    path: Path,
    json_path: Path,
    run_date: date,
    token_available: bool,
    levels: list[LevelResult],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    by_mode: dict[str, list[LevelResult]] = {}
    for level in levels:
        by_mode.setdefault(level.mode, []).append(level)
    token_ceiling = _practical_ceiling(by_mode.get("app_token", []))
    no_token_ceiling = _practical_ceiling(by_mode.get("no_token", []))
    snapshot_triggered = token_available and token_ceiling < 4
    lines = [
        "# Socrata Concurrency Probe - Phase 2",
        "",
        f"- Run date: {run_date.isoformat()}",
        f"- Configured assessment year: {ASSESSMENT_YEAR}",
        f"- Machine-readable results: `{json_path.as_posix()}`",
        "- Data source: Cook County Socrata through `SocrataClient` with no cache, timeouts, "
        "retries, backoff, and bounded page queries.",
        "- Token handling: the probe records only whether an app token was present; the token "
        "value is never written to this report or JSON.",
        "- Simulated user load: subject parcel, residential characteristics, assessed values, "
        "sales, and three bounded comparable-pool page queries.",
        "- Ramp policy: 1, 2, 4, and 8 parallel users; a mode stops early on sustained 429s, "
        "operation failures, or transient server-error concentration.",
        "",
        "## Summary",
        "",
        f"- Practical ceiling without app token: {no_token_ceiling or 'not established'} users.",
        f"- Practical ceiling with app token: {token_ceiling or 'not established'} users.",
        "- Local snapshot feasibility trigger: "
        + ("YES - token-backed ceiling below 4 users." if snapshot_triggered else "NO."),
        "",
        "## Level Results",
        "",
        "| Mode | Users | Users OK | Ops OK | HTTP requests | 429s | Retry successes | "
        "Median user ms | P95 user ms | Stop reason |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for level in levels:
        summary = _level_summary(level)
        lines.append(
            f"| {summary['mode']} | {summary['concurrency']} | "
            f"{summary['users_ok']}/{summary['users_total']} | "
            f"{summary['operations_ok']}/{summary['operations_total']} | "
            f"{summary['http_requests']} | {summary['http_429']} | "
            f"{summary['retry_successes']} | {summary['median_user_ms']} | "
            f"{summary['p95_user_ms']} | {summary['stop_reason'] or ''} |"
        )

    lines.extend(
        [
            "",
            "## Methodology",
            "",
            "- Each simulated user used a separate `SocrataClient` and `requests.Session`; "
            "no cache was used, so requests hit Socrata rather than local files.",
            "- Exact subject queries used PIN filters; comparable-pool queries were limited "
            "to a bounded first page of same-township/same-class rows.",
            "- The practical ceiling is the highest tested user count where all simulated users "
            "and operations succeeded, no HTTP 429 was observed, and p95 user load time stayed "
            "under 60 seconds.",
            "- Per-operation HTTP statuses and durations are available in the JSON report.",
        ]
    )
    if not token_available:
        lines.append(
            "- Token-backed mode was skipped because `SOCRATA_APP_TOKEN` was not present in "
            "the process environment."
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _parse_levels(text: str) -> list[int]:
    levels = [int(piece.strip()) for piece in text.split(",") if piece.strip()]
    if not levels or any(level < 1 for level in levels):
        raise argparse.ArgumentTypeError("levels must be a comma-separated list of positive ints")
    return levels


def run(args: argparse.Namespace) -> int:
    run_date = date.fromisoformat(args.run_date)
    token = os.environ.get("SOCRATA_APP_TOKEN")
    modes = ["no_token", "app_token"] if args.mode == "both" else [args.mode]
    levels: list[LevelResult] = []
    for mode in modes:
        if mode == "app_token" and not token:
            continue
        with _token_context(mode, token):
            levels.extend(_run_mode(mode, args.levels, args))
    json_path = Path(args.json_report)
    report_path = Path(args.report)
    _write_json(json_path, run_date, bool(token), levels)
    _write_report(report_path, json_path, run_date, bool(token), levels)
    print(f"Wrote {report_path}")
    print(f"Wrote {json_path}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    today = date.today().isoformat()
    parser = argparse.ArgumentParser(description="Probe polite Socrata concurrency limits.")
    parser.add_argument("--run-date", default=today)
    parser.add_argument("--levels", type=_parse_levels, default="1,2,4,8")
    parser.add_argument("--mode", choices=("both", "no_token", "app_token"), default="both")
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--max-retries", type=int, default=2)
    parser.add_argument("--page-size", type=int, default=100)
    parser.add_argument("--context-limit", type=int, default=50)
    parser.add_argument("--pause-seconds", type=float, default=3.0)
    parser.add_argument("--cache-dir", default=".cache/socrata_concurrency")
    parser.add_argument("--report", default=f"reports/concurrency_{today}.md")
    parser.add_argument("--json-report", default=f"reports/concurrency_{today}.json")
    return parser


def main() -> int:
    parser = build_parser()
    started = datetime.now()
    try:
        return run(parser.parse_args())
    finally:
        elapsed = (datetime.now() - started).total_seconds()
        print(f"Elapsed seconds: {elapsed:.1f}")


if __name__ == "__main__":
    raise SystemExit(main())
