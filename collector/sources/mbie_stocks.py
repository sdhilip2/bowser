"""MBIE Fuel Stocks — days-of-cover per fuel.

MBIE publishes this data as an HTML news article at
https://www.mbie.govt.nz/about/news/fuel-stocks-update
updated every Monday and Wednesday afternoon. No CSV feed exists, so we
parse the HTML table directly.

The "Current fuel stock" table follows this layout:

    Stock                                   Ships  Petrol  Diesel  Jet
    In-country                              —      28.3    23.7    27.9
    On water within EEZ (up to 2 days)      2      1.4     2.3     0.4
    On water outside EEZ (up to 3 weeks)    12     33.0    25.7    25.2
    Total NZ stock*                                62.6    51.7    53.5

Failure mode: if MBIE rearranges the page, `fetch()` returns None and the
frontend renders a "data unavailable" placeholder. The rest of the
collector is unaffected — one bad scraper never kills the daemon.
"""
from __future__ import annotations

import re
from datetime import datetime

import httpx

from schema import FuelStockBreakdown, FuelStocks

URL = "https://www.mbie.govt.nz/about/news/fuel-stocks-update"

# Month-day matcher used for parsing "as at 11:59PM Sunday 5 April"
DATE_RE = re.compile(
    r"(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+"
    r"(\d{1,2})\s+([A-Z][a-z]+)",
    re.IGNORECASE,
)

NUM = r"([0-9]+(?:\.[0-9]+)?)"


def _strip_html(html: str) -> str:
    plain = re.sub(r"<[^>]+>", " ", html)
    plain = plain.replace("&nbsp;", " ").replace("\u00a0", " ")
    plain = re.sub(r"\s+", " ", plain)
    return plain


def _parse_month_day(day: str, month_name: str) -> str:
    """Return ISO date. Assume year = current year unless month > current month by >3."""
    now = datetime.now()
    try:
        month_num = datetime.strptime(month_name[:3], "%b").month
    except ValueError:
        return ""
    year = now.year
    # If parsed month is >3 months ahead of today, it's from the previous year
    if month_num > now.month + 3:
        year -= 1
    try:
        return datetime(year, month_num, int(day)).date().isoformat()
    except ValueError:
        return ""


def fetch() -> FuelStocks | None:
    try:
        r = httpx.get(
            URL,
            timeout=30.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 bowser-collector"},
        )
        r.raise_for_status()
    except Exception:  # noqa: BLE001
        return None

    flat = _strip_html(r.text)

    # Take only the "Current fuel stock" block — the page also repeats a
    # "Previous fuel stock" section with slightly different numbers that
    # would pollute the match if we scanned the whole page.
    cur_idx = flat.find("Current fuel stock")
    prev_idx = flat.find("Previous fuel stock")
    if cur_idx < 0:
        return None
    end = prev_idx if prev_idx > cur_idx else len(flat)
    block = flat[cur_idx:end]

    # --- As-of date: "as at 11:59PM Sunday 5 April" ---------------------
    as_of_iso = ""
    dm = DATE_RE.search(block)
    if dm:
        as_of_iso = _parse_month_day(dm.group(1), dm.group(2))

    # --- Table rows -----------------------------------------------------
    # In-country has no ships column
    ic = re.search(rf"In-country\s+{NUM}\s+{NUM}\s+{NUM}", block)
    # Within/outside EEZ rows include a "(up to N ...)" hint *before* the
    # real numbers, so we anchor the match to "days away)" or "weeks away)"
    # to skip past the parenthetical.
    we = re.search(
        rf"On water within EEZ.*?away\)\s+([0-9]+)\s+{NUM}\s+{NUM}\s+{NUM}", block
    )
    oe = re.search(
        rf"On water outside EEZ.*?away\)\s+([0-9]+)\s+{NUM}\s+{NUM}\s+{NUM}", block
    )
    # Totals (asterisk may or may not follow)
    tot = re.search(rf"Total NZ stock\*?\s+{NUM}\s+{NUM}\s+{NUM}", block)

    if not (ic and we and oe and tot):
        return None

    def f(m, g: int) -> float:
        return float(m.group(g))

    petrol_total = f(tot, 1)
    diesel_total = f(tot, 2)
    jet_total = f(tot, 3)

    petrol_bd = FuelStockBreakdown(
        in_country=f(ic, 1), eez_water=f(we, 2), outside_eez=f(oe, 2)
    )
    diesel_bd = FuelStockBreakdown(
        in_country=f(ic, 2), eez_water=f(we, 3), outside_eez=f(oe, 3)
    )
    jet_bd = FuelStockBreakdown(
        in_country=f(ic, 3), eez_water=f(we, 4), outside_eez=f(oe, 4)
    )

    ships_in_eez = int(we.group(1))
    ships_outside_eez = int(oe.group(1))

    return FuelStocks(
        as_of=as_of_iso,
        published=datetime.now().date().isoformat(),
        petrol_days=petrol_total,
        diesel_days=diesel_total,
        jet_days=jet_total,
        petrol_breakdown=petrol_bd,
        diesel_breakdown=diesel_bd,
        jet_breakdown=jet_bd,
        ships_in_eez=ships_in_eez,
        ships_outside_eez=ships_outside_eez,
    )


if __name__ == "__main__":
    import time

    t0 = time.time()
    s = fetch()
    if s is None:
        print(f"[mbie_stocks] FAIL in {time.time() - t0:.1f}s")
    else:
        print(
            f"[mbie_stocks] ok petrol={s.petrol_days}d diesel={s.diesel_days}d "
            f"jet={s.jet_days}d ships={s.ships_in_eez}+{s.ships_outside_eez} "
            f"as_of={s.as_of} in {time.time() - t0:.1f}s"
        )
        print("  petrol breakdown:", s.petrol_breakdown)
        print("  diesel breakdown:", s.diesel_breakdown)
        print("  jet breakdown:   ", s.jet_breakdown)
