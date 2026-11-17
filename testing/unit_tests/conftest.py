"""Test setup: isolated temp data folder and the offline stub LLM."""
import os
import sys
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="irish_test_"))
os.environ.update({
    "LLM_PROVIDER": "stub",
    "LOCAL_STORE_FILE": str(_TMP / "store.json"),
    "HISTORY_DIR": str(_TMP / "history"),
    "CREDENTIAL_KEY_FILE": str(_TMP / "cred.key"),
    "NEO4J_URI": "",
    "DATABASE_URL": "",
})
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # Irish/
