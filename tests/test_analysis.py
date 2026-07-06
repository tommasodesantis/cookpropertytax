from __future__ import annotations

from dataclasses import replace
from datetime import date

from appeal_tool.analysis import analyze_comparables, build_evidence_summary
from appeal_tool.models import Comparable, UserEvidence
from appeal_tool.repository import FixtureRepository


def test_comparable_analysis_known_fixture_is_strong(fixture_repo: FixtureRepository) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0001")
    comps = analyze_comparables(case)
    assert comps.status == "ok"
    assert comps.pool_size == 10
    assert comps.percentile is not None
    assert comps.percentile >= 75
    assert comps.gap_pct is not None
    assert comps.gap_pct > 10


def test_condo_degrades_without_sqft(fixture_repo: FixtureRepository) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0020")
    comps = analyze_comparables(case)
    assert comps.status == "condo"
    assert "Condo" in comps.note


def test_missing_characteristics_degrades_without_crash(fixture_repo: FixtureRepository) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0030")
    comps = analyze_comparables(case)
    assert comps.status == "insufficient_data"
    assert "Missing subject" in comps.note


def test_evidence_summary_has_honest_tier(fixture_repo: FixtureRepository) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0001")
    evidence = build_evidence_summary(case, tax_rate=0.10)
    assert evidence.tier == "STRONG"
    assert evidence.savings_assumptions.point > 0


def test_comparable_analysis_uses_neighborhood_scope(fixture_repo: FixtureRepository) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0001")
    comps = tuple(
        Comparable(
            pin=f"0300000001{index:04d}",
            pin_formatted=f"03-00-000-001-{index:04d}",
            address=f"{index} TEST ST",
            building_sqft=1750 + index,
            year_built=None if index == 0 else 1924,
            av=35000 + index * 1000,
            neighborhood="0101",
            lat=None if index == 0 else 41.99,
            lon=None if index == 0 else -87.69,
        )
        for index in range(16)
    )
    scoped_case = replace(case, comparables=comps)
    analysis = analyze_comparables(scoped_case)
    assert analysis.status == "ok"
    assert analysis.scope == "neighborhood"
    assert analysis.pool_size == 16


def test_comparable_analysis_rejects_too_few_comps(fixture_repo: FixtureRepository) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0001")
    sparse_case = replace(case, comparables=case.comparables[:2])
    analysis = analyze_comparables(sparse_case)
    assert analysis.status == "insufficient_data"
    assert "too few" in analysis.note


def test_evidence_summary_supporting_uniformity_is_moderate(
    fixture_repo: FixtureRepository,
) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0001")
    parcel = replace(case.parcel, current_av=45000, prior_final_av=45000)
    psf_values = [20, 21, 22, 23, 24, 26, 27, 28]
    comps = tuple(
        Comparable(
            pin=f"0300000002{index:04d}",
            pin_formatted=f"03-00-000-002-{index:04d}",
            address=f"{index} MODERATE ST",
            building_sqft=1800,
            year_built=1924,
            av=1800 * psf,
            neighborhood="0101",
        )
        for index, psf in enumerate(psf_values)
    )
    moderate_case = replace(case, parcel=parcel, comparables=comps, subject_sales=())
    evidence = build_evidence_summary(moderate_case, tax_rate=0.10)
    assert evidence.tier == "MODERATE"
    assert any(arg.argument_type == "uniformity" for arg in evidence.arguments)


def test_evidence_summary_user_evidence_paths(fixture_repo: FixtureRepository) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0001")
    user_evidence = UserEvidence(
        purchase_price=500000,
        purchase_date=date(2024, 6, 1),
        appraisal_value=420000,
        appraisal_date=date(2024, 8, 1),
        actual_sqft=1600,
        condition_issues=("basement water damage",),
    )
    evidence_case = replace(
        case.with_user_evidence(user_evidence),
        subject_sales=(),
    )
    evidence = build_evidence_summary(evidence_case, tax_rate=0.10)
    argument_types = {argument.argument_type for argument in evidence.arguments}
    assert {"overvaluation", "property_description", "condition"} <= argument_types
    assert any("reported appraisal" in argument.text for argument in evidence.arguments)


def test_limited_evidence_path_has_no_forced_recommendation(
    fixture_repo: FixtureRepository,
) -> None:
    case = fixture_repo.load_case_by_pin("03-00-000-000-0030")
    parcel = replace(case.parcel, current_av=45000, prior_final_av=45000)
    limited_case = replace(case, parcel=parcel, subject_sales=())
    evidence = build_evidence_summary(limited_case, tax_rate=0.10)
    assert evidence.tier == "LIMITED"
    assert not evidence.arguments
