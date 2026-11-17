"""
Delete resumes from Google Cloud Storage (optional, set GCS_BUCKET in .env).

CLI:
    python -m configuration.google_cloud_delete all
    python -m configuration.google_cloud_delete Company/my_resume.pdf
"""
from __future__ import annotations

import sys

from configuration.settings import settings


def delete_cloud_resume(target: str) -> list[str]:
    if not settings.gcs_bucket:
        raise RuntimeError("GCS_BUCKET is not set in .env - Google Cloud delete is disabled.")
    try:
        from google.cloud import storage
    except ImportError as exc:
        raise RuntimeError("Install google-cloud-storage to use Google Cloud delete.") from exc

    bucket = storage.Client().bucket(settings.gcs_bucket)
    deleted: list[str] = []
    for blob in bucket.list_blobs(prefix="resumes/"):
        name = blob.name.removeprefix("resumes/")
        if target.lower() == "all" or name == target or name.endswith("/" + target):
            blob.delete()
            deleted.append(name)
    return deleted


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    removed = delete_cloud_resume(sys.argv[1])
    print("\n".join(removed) if removed else "Nothing deleted.")
