"""Shared helpers for the start scripts."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # the Irish folder
FRONTEND = ROOT / "frontend"


def python_exe() -> str:
    """Use the project's .venv Python if it exists, otherwise the current one."""
    win = ROOT / ".venv" / "Scripts" / "python.exe"
    nix = ROOT / ".venv" / "bin" / "python"
    for p in (win, nix):
        if p.exists():
            return str(p)
    return sys.executable


def npx_exe() -> str:
    exe = shutil.which("npx.cmd") or shutil.which("npx")
    if not exe:
        sys.exit("npx was not found. Install Node.js from https://nodejs.org and try again.")
    return exe


def ensure_node_modules() -> None:
    """Run npm install the first time (when frontend/node_modules is missing)."""
    if (FRONTEND / "node_modules").exists():
        return
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        sys.exit("npm was not found. Install Node.js from https://nodejs.org and try again.")
    print("frontend/node_modules not found - running npm install (first time only)...")
    subprocess.run([npm, "install"], cwd=FRONTEND, check=True)


def run(cmd: list[str], cwd: Path, title: str) -> None:
    """Run a command in the foreground until Ctrl+C."""
    print(f"\n=== Irish {title} ===")
    print("Folder :", cwd)
    print("Command:", " ".join(cmd))
    print("Press Ctrl+C to stop.\n")
    try:
        subprocess.run(cmd, cwd=cwd, env=os.environ.copy())
    except KeyboardInterrupt:
        pass
    print(f"\nIrish {title} stopped.")
