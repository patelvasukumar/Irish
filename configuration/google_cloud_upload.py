"""
Upload a saved resume to Google Cloud Storage (optional, set GCS_BUCKET in .env).

CLI:  python -m configuration.google_cloud_upload history/Company/my_resume.pdf
"""
from __future__ import annotations

import sys
from pathlib import Path

from configuration.settings import settings


def upload_resume(local_path: str | Path) -> str:
    if not settings.gcs_bucket:
        raise RuntimeError("GCS_BUCKET is not set in .env - Google Cloud upload is disabled.")
    try:
        from google.cloud import storage
    except ImportError as exc:
        raise RuntimeError("Install google-cloud-storage to use Google Cloud upload.") from exc

    path = Path(local_path).resolve()
    rel = path.relative_to(settings.history_dir.resolve()).as_posix()
    blob = storage.Client().bucket(settings.gcs_bucket).blob(f"resumes/{rel}")
    blob.upload_from_filename(str(path))
    return f"gs://{settings.gcs_bucket}/resumes/{rel}"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    print(upload_resume(sys.argv[1]))
