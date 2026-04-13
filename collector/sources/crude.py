"""Crude oil prices — Brent + WTI front-month futures from Yahoo Finance.

Originally this module pulled EIA RBRTE/RWTC spot prices via the EIA v2
API, but that series diverged sharply from real markets in Apr 2026 (EIA
reported Brent at $138.21/bbl on 07 Apr while every live market —
Yahoo, Bloomberg, Perplexity — showed a 52-week high of $119.40). The
root cause is unclear (EIA publication lag + their own revision process
produces noisy daily values that don't always match the ICE settlement
tape). For a dashboard that needs to match what a reader sees on Google,
we switched to Yahoo Finance's undocumented chart API, which tracks
front-month futures exactly as shown on markets.businessinsider et al.

Module name stays `eia.py` to minimise import churn. The public contract
is unchanged: `fetch() -> Crude`.

  - Brent: symbol BZ=F (ICE Brent front month on NYMEX feed)
  - WTI:   symbol CL=F (NYMEX WTI front month)
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from schema import Crude, CrudePoint, CrudeSeries

BASE = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
HEADERS = {"User-Agent": "Mozilla/5.0 bowser-collector"}

SYMBOLS = {"brent": "BZ=F", "wti": "CL=F"}


def _pct(a: float, b: float) -> float:
    if b == 0:
        return 0.0
    return round((a - b) / b * 100.0, 2)


def _fetch_symbol(symbol: str) -> list[CrudePoint]:
    params = {"interval": "1d", "range": "1y"}
    url = BASE.format(symbol=symbol)
    r = httpx.get(url, params=params, headers=HEADERS, timeout=30.0)
    r.raise_for_status()
    payload = r.json()
    result = payload["chart"]["result"][0]
    timestamps = result.get("timestamp", [])
    closes = result["indicators"]["quote"][0]["close"]

    points: list[CrudePoint] = []
    for ts, close in zip(timestamps, closes):
        if close is None:
            continue
        date = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
        points.append(CrudePoint(date=date, usd=round(float(close), 2)))

    if not points:
        raise RuntimeError(f"Yahoo Finance returned no usable data for {symbol}")
    return points


def _build(points: list[CrudePoint]) -> CrudeSeries:
    latest_point = points[-1]
    prev_1d = points[-2].usd if len(points) >= 2 else latest_point.usd
    prev_30d = points[-31].usd if len(points) >= 31 else points[0].usd
    return CrudeSeries(
        latest=round(latest_point.usd, 2),
        latest_date=latest_point.date,
        delta_1d_pct=_pct(latest_point.usd, prev_1d),
        delta_30d_pct=_pct(latest_point.usd, prev_30d),
        series=points,
    )


def fetch() -> Crude:
    brent_points = _fetch_symbol(SYMBOLS["brent"])
    wti_points = _fetch_symbol(SYMBOLS["wti"])
    return Crude(brent=_build(brent_points), wti=_build(wti_points))


if __name__ == "__main__":
    import time

    t0 = time.time()
    c = fetch()
    print(
        f"[crude] ok brent={c.brent.latest} ({c.brent.delta_1d_pct:+.2f}% prev "
        f"· {c.brent.delta_30d_pct:+.2f}% 30d) as_of={c.brent.latest_date} "
        f"wti={c.wti.latest} ({c.wti.delta_1d_pct:+.2f}% prev) "
        f"rows={len(c.brent.series)}+{len(c.wti.series)} in {time.time() - t0:.1f}s"
    )
