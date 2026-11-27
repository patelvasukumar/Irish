"""Start the Irish web app (Expo web) - opens in the browser.

    python -m web          (from inside the start folder)
    python -m start.web    (from the Irish folder)

Start the backend first (python -m start.backend) in another terminal.
"""
try:  # run from the Irish folder:  python -m start.web
    from start._common import FRONTEND, ensure_node_modules, npx_exe, run
except ModuleNotFoundError:  # run from inside start:  python -m web
    from _common import FRONTEND, ensure_node_modules, npx_exe, run

PORT = 8081


def main() -> None:
    ensure_node_modules()
    run([npx_exe(), "expo", "start", "--web", "--port", str(PORT)], cwd=FRONTEND, title="web")


if __name__ == "__main__":
    main()
