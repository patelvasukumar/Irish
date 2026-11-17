"""
C8 - Credential manager service.

Saves one login per company website. Passwords are encrypted at rest and are
never returned by the API (only masked). The app may open/sign in/apply on a
site ONLY when `permission_to_apply` is true for that site.
"""
from __future__ import annotations

from functools import lru_cache
from urllib.parse import urlparse

from backend.credential_manager.independent.crypto import Vault, load_or_create_key, mask
from backend.storage.dependent.store import CREDENTIALS, get_store
from configuration.settings import settings


@lru_cache(maxsize=1)
def _vault() -> Vault:
    return Vault(load_or_create_key(settings.credential_key_file))


def _public(row: dict) -> dict:
    return {
        "id": row["id"],
        "company": row["company"],
        "site_url": row["site_url"],
        "domain": row.get("domain"),
        "username": row["username"],
        "password_masked": "********",
        "username_masked": mask(row["username"]),
        "permission_to_apply": row.get("permission_to_apply", False),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def list_credentials() -> list[dict]:
    return [_public(r) for r in get_store().all(CREDENTIALS)]


def add_credential(company: str, site_url: str, username: str, password: str,
                   permission_to_apply: bool = False) -> dict:
    row = get_store().insert(CREDENTIALS, {
        "company": company.strip(),
        "site_url": site_url.strip(),
        "domain": urlparse(site_url).hostname,
        "username": username.strip(),
        "password_encrypted": _vault().encrypt(password),
        "permission_to_apply": permission_to_apply,
    })
    return _public(row)


def update_credential(cred_id: str, changes: dict) -> dict | None:
    changes = {k: v for k, v in changes.items() if v is not None}
    if "password" in changes:
        changes["password_encrypted"] = _vault().encrypt(changes.pop("password"))
    if "site_url" in changes:
        changes["domain"] = urlparse(changes["site_url"]).hostname
    row = get_store().update(CREDENTIALS, cred_id, changes)
    return _public(row) if row else None


def delete_credential(cred_id: str) -> bool:
    return get_store().delete(CREDENTIALS, cred_id)


def get_login_for_automation(cred_id: str) -> dict:
    """
    Internal use only (browser automation). Refuses unless the user gave
    permission for this site. Never exposed through the API.
    """
    row = get_store().get(CREDENTIALS, cred_id)
    if not row:
        raise KeyError("Credential not found")
    if not row.get("permission_to_apply"):
        raise PermissionError(f"No permission to open or apply on {row['site_url']}")
    return {"site_url": row["site_url"], "username": row["username"],
            "password": _vault().decrypt(row["password_encrypted"])}
