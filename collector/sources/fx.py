"""NZD/USD exchange rate from open.er-api.com."""
from __future__ import annotations

import httpx

from schema import FX

URL = "https://open.er-api.com/v6/latest/USD"


def fetch() -> FX:
    r = httpx.get(URL, timeout=15.0)
    r.raise_for_status()
    payload = r.json()
    nzd = float(payload["rates"]["NZD"])
    as_of = payload.get("time_last_update_utc") or ""
    return FX(nzd_per_usd=nzd, as_of=as_of)


if __name__ == "__main__":
    import time

    t0 = time.time()
    fx = fetch()
    print(f"[fx] ok nzd/usd={fx.nzd_per_usd:.4f} in {time.time() - t0:.1f}s")
