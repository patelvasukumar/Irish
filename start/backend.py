"""Start the Irish backend (FastAPI) on port 8000.

    python -m backend          (from inside the start folder)
    python -m start.backend    (from the Irish folder)

Listens on 0.0.0.0 so the phone app (Expo Go) on the same Wi-Fi can reach it.
API docs: http://127.0.0.1:8000/docs
"""
try:  # run from the Irish folder:  python -m start.backend
    from start._common import ROOT, python_exe, run
except ModuleNotFoundError:  # run from inside start:  python -m backend
    from _common import ROOT, python_exe, run

PORT = 8000


def main() -> None:
    if not (ROOT / ".env").exists():
        print("Note: no .env file found - using defaults. (copy .env.example .env to change settings)")
    print(f"API docs will be at http://127.0.0.1:{PORT}/docs")
    run(
        [python_exe(), "-m", "uvicorn", "backend.main:app", "--reload", "--host", "0.0.0.0", "--port", str(PORT)],
        cwd=ROOT,
        title="backend",
    )


if __name__ == "__main__":
    main()
