"""
Delete locally saved resumes from history/.

CLI:
    python -m configuration.local_delete all                    -> deletes every saved resume
    python -m configuration.local_delete my_resume.pdf          -> deletes files with that name
    python -m configuration.local_delete Company/my_resume.pdf  -> deletes only that file
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from configuration.settings import settings


def delete_resume(target: str) -> list[str]:
    """Delete 'all' resumes or the one matching a file name. Returns deleted paths."""
    history: Path = settings.history_dir.resolve()
    if not history.exists():
        return []
    deleted: list[str] = []

    if target.strip().lower() == "all":
        for child in history.iterdir():
            if child.name == ".gitkeep":
                continue
            deleted.append(child.name)
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
        return deleted

    candidate = (history / target).resolve()
    if history not in candidate.parents:
        raise ValueError("Path must stay inside the history folder")
    if candidate.is_file():
        matches = [candidate]
    else:
        matches = [p for p in history.rglob(Path(target).name) if p.is_file()]
    for path in matches:
        path.unlink()
        deleted.append(path.relative_to(history).as_posix())
        if path.parent != history and not any(path.parent.iterdir()):
            path.parent.rmdir()  # remove the empty company folder
    return deleted


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    removed = delete_resume(sys.argv[1])
    print("\n".join(removed) if removed else "Nothing deleted.")
