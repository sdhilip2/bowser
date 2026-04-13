"""Google News RSS → top 8 NZ fuel news + top 8 global oil/geopolitics.

The "global" column fans out across multiple queries (markets, Iran,
US policy, OPEC / Middle East) then deduplicates by URL and sorts by
publication date DESC so the freshest geopolitical story sits on top —
because oil prices respond to politics faster than to supply fundamentals.

We strip Google News's redirect wrapper when it takes the legacy form.
The newer encoded `/rss/articles/CBMi...` links are not the direct
publisher URL but still resolve correctly on click.
"""
from __future__ import annotations

from datetime import datetime, timezone
from time import mktime
from urllib.parse import parse_qs, urlparse

import feedparser

from schema import News, NewsItem

TOP_N = 8
FETCH_PER_QUERY = 15  # over-fetch then trim after dedup + sort


def _url(q: str, hl: str = "en", gl: str = "US", ceid: str = "US:en") -> str:
    from urllib.parse import quote_plus

    return (
        "https://news.google.com/rss/search?"
        f"q={quote_plus(q)}&hl={hl}&gl={gl}&ceid={ceid}"
    )


NZ_QUERIES = [
    _url("New Zealand fuel price", hl="en-NZ", gl="NZ", ceid="NZ:en"),
    _url("New Zealand petrol diesel", hl="en-NZ", gl="NZ", ceid="NZ:en"),
]

GLOBAL_QUERIES = [
    # Market fundamentals
    _url("global oil price crude"),
    _url('"Brent" OR "WTI" crude'),
    # Geopolitics that moves the oil tape
    _url("Iran oil sanctions"),
    _url("US oil policy OPEC"),
    _url("Middle East oil supply"),
    _url("Russia oil sanctions"),
]


def _unwrap_google(url: str) -> str:
    parsed = urlparse(url)
    if parsed.netloc.endswith("google.com") and parsed.path.startswith("/url"):
        q = parse_qs(parsed.query).get("q")
        if q:
            return q[0]
    return url


def _published_ts(entry) -> float:
    """Return a UNIX timestamp for sorting. 0 if missing or unparseable."""
    pp = getattr(entry, "published_parsed", None)
    if pp is not None:
        try:
            return mktime(pp)
        except Exception:  # noqa: BLE001
            return 0.0
    raw = getattr(entry, "published", "") or ""
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %Z",
        "%a, %d %b %Y %H:%M:%S %z",
        "%Y-%m-%dT%H:%M:%S%z",
    ):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
    return 0.0


def _parse_one(url: str) -> list[tuple[float, NewsItem]]:
    feed = feedparser.parse(url)
    items: list[tuple[float, NewsItem]] = []
    for entry in feed.entries[:FETCH_PER_QUERY]:
        source = ""
        src = getattr(entry, "source", None)
        if isinstance(src, dict):
            source = src.get("title", "") or ""
        elif src:
            source = str(src)
        item = NewsItem(
            title=getattr(entry, "title", "").strip(),
            source=source.strip(),
            published=getattr(entry, "published", "") or "",
            url=_unwrap_google(getattr(entry, "link", "") or ""),
        )
        items.append((_published_ts(entry), item))
    return items


def _collect(queries: list[str]) -> list[NewsItem]:
    collected: list[tuple[float, NewsItem]] = []
    for q in queries:
        try:
            collected.extend(_parse_one(q))
        except Exception:  # noqa: BLE001
            # One bad query shouldn't kill the feed — just skip it
            continue

    # Dedupe by URL (first occurrence wins — and since we'll sort by ts
    # after, the winner doesn't matter for ordering).
    seen: set[str] = set()
    unique: list[tuple[float, NewsItem]] = []
    for ts, item in collected:
        if not item.url or item.url in seen:
            continue
        seen.add(item.url)
        unique.append((ts, item))

    # Sort by published DESC, freshest first
    unique.sort(key=lambda row: row[0], reverse=True)
    return [item for _, item in unique[:TOP_N]]


def fetch() -> News:
    nz = _collect(NZ_QUERIES)
    global_ = _collect(GLOBAL_QUERIES)
    return News(nz=nz, global_=global_)


if __name__ == "__main__":
    import time

    t0 = time.time()
    n = fetch()
    print(f"[news] ok nz={len(n.nz)} global={len(n.global_)} in {time.time() - t0:.1f}s")
    print("  nz latest 3:")
    for i in n.nz[:3]:
        print(f"    · {i.title[:85]}")
        print(f"       {i.source} · {i.published}")
    print("  global latest 3:")
    for i in n.global_[:3]:
        print(f"    · {i.title[:85]}")
        print(f"       {i.source} · {i.published}")
