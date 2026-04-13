"""CardLink PriceWatch — NZ national fuel prices from fuel-card transactions.

Fetches https://www.pricewatch.co.nz/ once per collector run and parses
the HTML brand-by-fuel tables across all 19 NZ regions. PriceWatch is a
free public service run by CardLink (NZ fuel card processing), not a
commercial data product — their Gaspy/Datamine competitor in terms of
*what* it shows, but a very different legal posture.

Structure: each region renders a `<tr><td>BRAND</td>[5 price cells]</tr>`
table. The 5 columns are fixed: 98 / 95-96 / 91 / Diesel / LPG. Prices
are either `$X.XXX` (a dollar amount, not cents) or `n/a`. We aggregate
across all brands × all regions to get national min/max/avg per fuel.

Bonus signal: the HTML carries bgcolor hints marking each price as
"today" (C4F1FF), "yesterday" (EBEBEB), or "before yesterday" (3399FF).
We include a `freshness` field that counts how many prices are today-vs-
older so readers know if the snapshot is truly fresh or partly cached.

Failure mode: if CardLink changes the page layout, `fetch()` returns
None and the compare section disappears gracefully. Everything else in
the collector continues.
"""
from __future__ import annotations

import re
from datetime import datetime

import httpx

from schema import FuelSummary, NZRetail

URL = "https://www.pricewatch.co.nz/"
HEADERS = {"User-Agent": "Mozilla/5.0 bowser-collector"}

# Brand-row pattern: <td>BRAND</td> followed by 5 <td> cells
BRAND_ROW_RE = re.compile(
    r"<td>\s*([A-Z][A-Z &'\-\.]*?)\s*</td>"
    r"((?:<td[^>]*>.*?</td>\s*){5})",
    re.DOTALL,
)
CELL_RE = re.compile(r"<td([^>]*)>(.*?)</td>", re.DOTALL)
PRICE_RE = re.compile(r"\$\s*([0-9]+\.[0-9]+)")
BGCOLOR_RE = re.compile(r"bgcolor\s*=\s*['\"]?#?([A-Fa-f0-9]{3,6})", re.I)

FUEL_ORDER = ["premium_98", "premium_95", "regular_91", "diesel", "lpg"]

# Freshness mapping — CardLink encodes price age via cell background
FRESH_COLORS = {
    "c4f1ff": "today",
    "ebebeb": "yesterday",
    "3399ff": "older",
    "cccccc": "na",  # n/a cells
}


def _summarise(prices: list[float]) -> FuelSummary:
    if not prices:
        return FuelSummary(avg=0.0, min=0.0, max=0.0, count=0)
    return FuelSummary(
        avg=round(sum(prices) / len(prices), 3),
        min=round(min(prices), 3),
        max=round(max(prices), 3),
        count=len(prices),
    )


def fetch() -> NZRetail | None:
    try:
        r = httpx.get(URL, headers=HEADERS, timeout=30.0, follow_redirects=True)
        r.raise_for_status()
    except Exception:  # noqa: BLE001
        return None

    html = r.text
    # Aggregate prices per fuel across all brand rows in all regions
    buckets: dict[str, list[float]] = {k: [] for k in FUEL_ORDER}
    freshness_counts: dict[str, int] = {"today": 0, "yesterday": 0, "older": 0}

    for brand_match in BRAND_ROW_RE.finditer(html):
        cells_html = brand_match.group(2)
        cells = CELL_RE.findall(cells_html)[:5]
        for i, (td_attrs, td_content) in enumerate(cells):
            price_match = PRICE_RE.search(td_content)
            if not price_match:
                continue
            price = float(price_match.group(1))
            # Sanity bound — NZ fuel is typically $1.50-$5.00/L
            if price < 1.0 or price > 10.0:
                continue
            fuel_key = FUEL_ORDER[i]
            buckets[fuel_key].append(price)
            # Freshness: read the bgcolor of the cell
            bg_match = BGCOLOR_RE.search(td_attrs)
            if bg_match:
                fresh = FRESH_COLORS.get(bg_match.group(1).lower(), "older")
                if fresh in freshness_counts:
                    freshness_counts[fresh] += 1

    if not buckets["regular_91"]:
        return None  # parse failure — no 91 observations found

    return NZRetail(
        as_of=datetime.now().date().isoformat(),
        regular_91=_summarise(buckets["regular_91"]),
        premium_95=_summarise(buckets["premium_95"]),
        premium_98=_summarise(buckets["premium_98"]),
        diesel=_summarise(buckets["diesel"]),
        lpg=_summarise(buckets["lpg"]),
        observations_today=freshness_counts["today"],
        observations_yesterday=freshness_counts["yesterday"],
        observations_older=freshness_counts["older"],
    )


if __name__ == "__main__":
    import time

    t0 = time.time()
    s = fetch()
    if s is None:
        print(f"[cardlink] FAIL in {time.time() - t0:.1f}s")
    else:
        def fmt(x: FuelSummary) -> str:
            return f"avg=${x.avg:.3f} min=${x.min:.3f} max=${x.max:.3f} n={x.count}"

        print(
            f"[cardlink] ok 91: {fmt(s.regular_91)} | 95: {fmt(s.premium_95)} | "
            f"98: {fmt(s.premium_98)} | diesel: {fmt(s.diesel)} | lpg: {fmt(s.lpg)} "
            f"in {time.time() - t0:.1f}s"
        )
        print(
            f"  freshness: today={s.observations_today} "
            f"yesterday={s.observations_yesterday} older={s.observations_older}"
        )
