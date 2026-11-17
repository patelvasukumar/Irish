"""
Open a job posting link and read its text (flow step 2).

Some job sites block bots or need a login (risk R2). In that case a clear
error is returned so the user can paste the text or upload a screenshot.
"""
from __future__ import annotations

import ipaddress
import json
import socket
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from backend.text_recognition.independent.skill_extractor import normalize_text

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-CA,en;q=0.9",
}


class PostingFetchError(Exception):
    pass


def _check_public_url(url: str) -> None:
    """Block non-http schemes and private/local addresses (SSRF guard)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise PostingFetchError("Only http(s) links are supported.")
    try:
        for info in socket.getaddrinfo(parsed.hostname, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                raise PostingFetchError("Links to private or local addresses are not allowed.")
    except socket.gaierror as exc:
        raise PostingFetchError(f"Could not resolve host: {parsed.hostname}") from exc


def _from_json_ld(soup: BeautifulSoup) -> str | None:
    """Many job boards embed a schema.org JobPosting - use it when present."""
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for item in items:
            if isinstance(item, dict) and item.get("@type") == "JobPosting":
                desc = BeautifulSoup(item.get("description", ""), "html.parser").get_text("\n")
                org = (item.get("hiringOrganization") or {}).get("name", "")
                loc = item.get("jobLocation") or {}
                if isinstance(loc, list):
                    loc = loc[0] if loc else {}
                addr = (loc.get("address") or {}) if isinstance(loc, dict) else {}
                place = ", ".join(
                    x for x in [addr.get("addressLocality"), addr.get("addressRegion")] if x
                )
                return (
                    f"Job Title: {item.get('title', '')}\nCompany: {org}\n"
                    f"Location: {place}\n\n{desc}"
                )
    return None


def fetch_posting(url: str, timeout: float = 20.0) -> dict:
    """Return {'url', 'text', 'source'} for a job posting link."""
    _check_public_url(url)
    try:
        with httpx.Client(headers=_HEADERS, follow_redirects=True, timeout=timeout) as client:
            response = client.get(url)
    except httpx.HTTPError as exc:
        raise PostingFetchError(f"Could not open the link: {exc}") from exc
    if response.status_code in (401, 403):
        raise PostingFetchError(
            "The job site blocked the request or needs a login. Paste the text or upload a screenshot."
        )
    if response.status_code >= 400:
        raise PostingFetchError(f"The job site returned HTTP {response.status_code}.")

    soup = BeautifulSoup(response.text, "html.parser")
    structured = _from_json_ld(soup)
    if structured:
        return {"url": str(response.url), "text": normalize_text(structured), "source": "json-ld"}

    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "svg", "form"]):
        tag.decompose()
    main = soup.find("main") or soup.find("article") or soup.body or soup
    text = normalize_text(main.get_text("\n"))
    if len(text.split()) < 40:
        raise PostingFetchError(
            "Could not read enough text from this page (it may load with JavaScript). "
            "Paste the text or upload a screenshot."
        )
    title = soup.title.get_text(strip=True) if soup.title else ""
    return {"url": str(response.url), "text": f"{title}\n\n{text}" if title else text, "source": "html"}
