"""
C8 - Encryption helpers for saved logins (risk R11).

Passwords are encrypted with Fernet (AES-128-CBC + HMAC). The key lives in a
local file that is git-ignored and is never sent to GitHub or Google Cloud.
"""
from __future__ import annotations

import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken


def load_or_create_key(path: Path) -> bytes:
    path = Path(path)
    if path.exists():
        return path.read_bytes().strip()
    path.parent.mkdir(parents=True, exist_ok=True)
    key = Fernet.generate_key()
    path.write_bytes(key)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return key


class Vault:
    def __init__(self, key: bytes) -> None:
        self._fernet = Fernet(key)

    def encrypt(self, secret: str) -> str:
        return self._fernet.encrypt(secret.encode("utf-8")).decode("ascii")

    def decrypt(self, token: str) -> str:
        try:
            return self._fernet.decrypt(token.encode("ascii")).decode("utf-8")
        except InvalidToken as exc:
            raise ValueError("Cannot decrypt - the key file changed or the data is corrupt.") from exc


def mask(value: str) -> str:
    if not value:
        return ""
    return value[0] + "*" * max(3, len(value) - 2) + value[-1] if len(value) > 2 else "***"
