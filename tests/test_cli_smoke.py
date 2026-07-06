from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest


def run_cli(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "appeal_tool.py", *args],
        text=True,
        capture_output=True,
        check=False,
    )


@pytest.mark.parametrize(
    ("pin", "venue_args"),
    [
        ("03-00-000-000-0001", ["--venue", "bor", "--today", "2025-07-10"]),
        ("03-00-000-000-0020", ["--venue", "bor", "--today", "2025-07-10"]),
        ("03-00-000-000-0030", ["--venue", "bor", "--today", "2025-07-10"]),
        ("03-00-000-000-0001", ["--venue", "assessor", "--today", "2025-02-15"]),
        ("03-00-000-000-0020", ["--venue", "assessor", "--today", "2025-02-15"]),
        ("03-00-000-000-0030", ["--venue", "assessor", "--today", "2025-02-15"]),
        (
            "03-00-000-000-0001",
            ["--venue", "ptab", "--today", "2026-06-01", "--bor-decision-date", "2026-05-20"],
        ),
        (
            "03-00-000-000-0020",
            ["--venue", "ptab", "--today", "2026-06-01", "--bor-decision-date", "2026-05-20"],
        ),
        (
            "03-00-000-000-0030",
            ["--venue", "ptab", "--today", "2026-06-01", "--bor-decision-date", "2026-05-20"],
        ),
        ("03-00-000-000-0040", ["--venue", "auto", "--today", "2025-07-10"]),
        ("03-00-000-000-0040", ["--venue", "assessor", "--today", "2025-07-10"]),
        ("03-00-000-000-0040", ["--venue", "bor", "--today", "2025-07-10"]),
        (
            "03-00-000-000-0040",
            ["--venue", "ptab", "--today", "2026-06-01", "--bor-decision-date", "2026-05-20"],
        ),
    ],
)
def test_cli_smoke_paths(
    fixture_dir: Path, tmp_path: Path, pin: str, venue_args: list[str]
) -> None:
    result = run_cli(
        [
            "--pin",
            pin,
            "--fixture-dir",
            str(fixture_dir),
            "--output-dir",
            str(tmp_path),
            *venue_args,
        ]
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "ROUTING DECISION" in result.stdout
    assert "Traceback" not in result.stdout
    assert "Traceback" not in result.stderr
    assert list(tmp_path.glob("packet_*.pdf"))


def test_cli_invalid_pin_is_user_facing(fixture_dir: Path) -> None:
    result = run_cli(["--pin", "bad", "--fixture-dir", str(fixture_dir), "--no-pdf"])
    assert result.returncode == 2
    assert "Invalid PIN" in result.stdout
    assert "Traceback" not in result.stdout + result.stderr


@pytest.mark.parametrize(
    "args",
    [
        ["--pin", "03-00-000-000-0001", "--purchase-price", "-1"],
        ["--pin", "03-00-000-000-0001", "--purchase-date", "2024/01/01"],
        ["--address", "NO SUCH ADDRESS"],
    ],
)
def test_cli_garbage_inputs_are_user_facing(fixture_dir: Path, args: list[str]) -> None:
    result = run_cli([*args, "--fixture-dir", str(fixture_dir), "--no-pdf"])
    assert result.returncode == 2
    assert "Input error:" in result.stdout
    assert "Traceback" not in result.stdout + result.stderr


def test_cli_ambiguous_address_lists_choices(fixture_dir: Path) -> None:
    result = run_cli(["--address", "MOZART", "--fixture-dir", str(fixture_dir), "--no-pdf"])
    assert result.returncode == 2
    assert "Ambiguous address" in result.stdout
    assert "03-00-000-000-0001" in result.stdout
    assert "03-00-000-000-0020" in result.stdout
    assert "Traceback" not in result.stdout + result.stderr


def test_cli_ptab_without_decision_date_refuses_to_guess(fixture_dir: Path) -> None:
    result = run_cli(
        [
            "--pin",
            "03-00-000-000-0001",
            "--fixture-dir",
            str(fixture_dir),
            "--venue",
            "ptab",
            "--today",
            "2026-06-01",
            "--no-pdf",
        ]
    )
    assert result.returncode == 2
    assert "cannot be computed" in result.stdout
    assert "refuses to guess" in result.stdout
    assert "Traceback" not in result.stdout + result.stderr
