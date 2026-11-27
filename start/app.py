"""Start the Irish mobile app (Expo) for Android / iPhone.

    python -m app          (from inside the start folder)
    python -m start.app    (from the Irish folder)

Scan the QR code with Expo Go (same Wi-Fi as the laptop),
or press  a = Android emulator,  i = iOS simulator (Mac only).
Uses port 8082 so it can run at the same time as the web app (8081).
Start the backend first (python -m start.backend) in another terminal.
"""
try:  # run from the Irish folder:  python -m start.app
    from start._common import FRONTEND, ensure_node_modules, npx_exe, run
except ModuleNotFoundError:  # run from inside start:  python -m app
    from _common import FRONTEND, ensure_node_modules, npx_exe, run

PORT = 8082


def main() -> None:
    ensure_node_modules()
    run([npx_exe(), "expo", "start", "--port", str(PORT)], cwd=FRONTEND, title="app")


if __name__ == "__main__":
    main()
