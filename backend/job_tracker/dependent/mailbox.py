"""
C7 - Read-only mailbox reader (IMAP).

Reads only headers (subject, sender, date) and a short snippet of new emails
and passes them to the tracker. The mailbox is opened READ-ONLY, so nothing
is marked as read, moved or deleted. Use an app password (e.g. Gmail).
"""
from __future__ import annotations

import email
import imaplib
from datetime import datetime, timedelta
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime

from backend.job_tracker.dependent.tracker_service import ingest_email
from configuration.settings import settings


def _decode(value: str | None) -> str:
    return str(make_header(decode_header(value))) if value else ""


def _snippet(msg: email.message.Message, limit: int = 400) -> str:
    for part in msg.walk() if msg.is_multipart() else [msg]:
        if part.get_content_type() == "text/plain":
            payload = part.get_payload(decode=True) or b""
            return payload.decode(part.get_content_charset() or "utf-8", errors="ignore")[:limit]
    return ""


def check_mailbox(days: int = 14, limit: int = 100) -> dict:
    if not (settings.imap_user and settings.imap_password):
        raise RuntimeError("Mailbox not configured. Set IMAP_HOST, IMAP_USER and IMAP_PASSWORD in .env.")
    since = (datetime.now() - timedelta(days=days)).strftime("%d-%b-%Y")
    results = []
    with imaplib.IMAP4_SSL(settings.imap_host) as imap:
        imap.login(settings.imap_user, settings.imap_password)
        imap.select(settings.imap_folder, readonly=True)
        _, data = imap.search(None, f'(SINCE "{since}")')
        ids = data[0].split()[-limit:]
        for num in ids:
            _, msg_data = imap.fetch(num, "(BODY.PEEK[])")
            msg = email.message_from_bytes(msg_data[0][1])
            try:
                received = parsedate_to_datetime(msg.get("Date")).isoformat()
            except (TypeError, ValueError):
                received = None
            res = ingest_email(
                subject=_decode(msg.get("Subject")),
                sender=_decode(msg.get("From")),
                snippet=_snippet(msg),
                received_at=received,
                message_id=msg.get("Message-ID"),
            )
            if res.get("is_job") and not res.get("skipped"):
                results.append(res)
    return {"checked": len(ids), "job_emails": len(results), "results": results}
