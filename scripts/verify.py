from __future__ import annotations

import subprocess

COMMANDS = [
    ["ruff", "check", "."],
    ["ruff", "format", "--check", "."],
    ["python", "-m", "mypy", "appeal_tool", "scripts/verify.py"],
    ["python", "-m", "py_compile", "appeal_tool.py"],
    [
        "python",
        "-m",
        "pytest",
        "--cov=appeal_tool.analysis",
        "--cov=appeal_tool.math_utils",
        "--cov=appeal_tool.routing",
        "--cov=appeal_tool.pin",
        "--cov-fail-under=85",
    ],
]


def main() -> int:
    for command in COMMANDS:
        print(f"$ {' '.join(command)}")
        completed = subprocess.run(command, check=False)
        if completed.returncode != 0:
            return completed.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
