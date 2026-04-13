"""MBIE Weekly Fuel Monitoring → waterfall components + historical retail.

The waterfall chart shows the 4 components MBIE publishes in every week
(Provisional or Final): `Price excluding tax`, `ETS`, `Taxes` (excise),
`GST`. Together they sum to `Adjusted retail price`.

`Importer cost` and `Importer margin` — which split `Price excluding tax`
into acquisition vs profit — are only published once MBIE *finalises* a
week (2-4 months later). We grab that split from the latest Final week
separately and attach it as `historical_split` for editorial context.
The main waterfall always shows the freshest Provisional week so the
chart tracks the current pump price within ~1-2 weeks, not ~15.

Default fuel is Regular Petrol — the grade most NZ drivers track.
"""
from __future__ import annotations

import io
from datetime import datetime

import httpx
import pandas as pd

from schema import (
    HistoricalRetail,
    HistoricalRetailPoint,
    HistoricalSplit,
    MBIEWaterfall,
    WaterfallComponents,
)

URL = (
    "https://www.mbie.govt.nz/assets/Data-Files/Energy/"
    "Weekly-fuel-price-monitoring/weekly-table.csv"
)

FUEL = "Regular Petrol"

# Variables required for a valid 4-component waterfall
REQUIRED_VARS = (
    "Price excluding tax",
    "ETS",
    "Taxes",
    "GST",
    "Adjusted retail price",
)


def _iso_week_ending(date_str: str) -> str:
    """Convert MBIE DD/MM/YYYY to ISO YYYY-MM-DD."""
    return datetime.strptime(date_str, "%d/%m/%Y").date().isoformat()


def _download() -> pd.DataFrame:
    r = httpx.get(URL, timeout=60.0, follow_redirects=True)
    r.raise_for_status()
    return pd.read_csv(io.BytesIO(r.content))


def _latest_week_with_vars(
    rows: pd.DataFrame, required: tuple[str, ...]
) -> str | None:
    """Return the latest Week string for which the row subset has every
    required Variable. Walks weeks newest-first and picks the first
    complete one. Returns None if no week qualifies."""
    if rows.empty:
        return None
    rows = rows.copy()
    rows["parsed_date"] = pd.to_datetime(
        rows["Date"], format="%d/%m/%Y", errors="coerce"
    )
    rows = rows.dropna(subset=["parsed_date"])
    weeks_desc = (
        rows.sort_values("parsed_date", ascending=False)["Week"].unique()
    )
    for wk in weeks_desc:
        wk_rows = rows[rows["Week"] == wk]
        present = set(wk_rows["Variable"].unique())
        if all(v in present for v in required):
            return str(wk)
    return None


def _get_value(week_rows: pd.DataFrame, variable: str, context: str) -> float:
    row = week_rows[week_rows["Variable"] == variable]
    if row.empty:
        raise RuntimeError(f"MBIE: missing '{variable}' for {context}")
    return round(float(row.iloc[0]["Value"]), 2)


def _historical_split(df: pd.DataFrame, fuel: str) -> HistoricalSplit | None:
    """Find the latest Final week for the fuel that has both Importer
    cost and Importer margin — these are the split values we show as
    supporting context under the waterfall."""
    finals = df[(df["Status"] == "Final") & (df["Fuel"] == fuel)]
    wk = _latest_week_with_vars(finals, ("Importer cost", "Importer margin"))
    if wk is None:
        return None
    wk_rows = finals[finals["Week"] == wk]
    ic = _get_value(wk_rows, "Importer cost", f"final {wk}")
    im = _get_value(wk_rows, "Importer margin", f"final {wk}")
    week_ending = _iso_week_ending(wk_rows.iloc[0]["Date"])
    return HistoricalSplit(
        week_ending=week_ending,
        importer_cost=ic,
        importer_margin=im,
    )


def fetch(fuel: str = FUEL, df: pd.DataFrame | None = None) -> MBIEWaterfall:
    if df is None:
        df = _download()

    # Primary waterfall: latest Provisional week with all 4 non-finalised
    # components. Falls back to Final if MBIE ever flips old weeks but
    # publishes no Provisional (unlikely but defensive).
    provisionals = df[(df["Status"] == "Provisional") & (df["Fuel"] == fuel)]
    wk = _latest_week_with_vars(provisionals, REQUIRED_VARS)
    source_df = provisionals
    if wk is None:
        finals_for_fuel = df[(df["Status"] == "Final") & (df["Fuel"] == fuel)]
        wk = _latest_week_with_vars(finals_for_fuel, REQUIRED_VARS)
        source_df = finals_for_fuel
    if wk is None:
        raise RuntimeError(f"MBIE: no week has all required variables for {fuel}")

    wk_rows = source_df[source_df["Week"] == wk]
    context = f"{wk} ({fuel})"

    pre_tax = _get_value(wk_rows, "Price excluding tax", context)
    ets = _get_value(wk_rows, "ETS", context)
    excise = _get_value(wk_rows, "Taxes", context)  # MBIE calls excise "Taxes"
    gst = _get_value(wk_rows, "GST", context)
    adjusted_retail = _get_value(wk_rows, "Adjusted retail price", context)

    week_ending = _iso_week_ending(wk_rows.iloc[0]["Date"])

    return MBIEWaterfall(
        week_ending=week_ending,
        fuel=fuel,  # type: ignore[arg-type]
        components=WaterfallComponents(
            pre_tax=pre_tax,
            ets=ets,
            excise=excise,
            gst=gst,
        ),
        adjusted_retail=adjusted_retail,
        historical_split=_historical_split(df, fuel),
    )


def fetch_historical(
    years: int = 10,
    df: pd.DataFrame | None = None,
) -> HistoricalRetail:
    """Extract weekly adjusted retail prices per fuel for the last N years.

    Uses both Final and Provisional rows since adjusted retail stays stable
    across status transitions (the provisional gap is only on cost/margin
    components). Gives a continuous line up to the most recent week.
    """
    if df is None:
        df = _download()
    variable = "Adjusted retail price"
    fuels = {
        "Regular Petrol": "regular_91",
        "Premium Petrol 95R": "premium_95",
        "Diesel": "diesel",
    }
    rows = df[df["Variable"] == variable].copy()

    series: dict[str, list[HistoricalRetailPoint]] = {
        "regular_91": [],
        "premium_95": [],
        "diesel": [],
    }

    cutoff = datetime.now().year - years
    for mbie_fuel, field in fuels.items():
        sub = rows[rows["Fuel"] == mbie_fuel].copy()
        sub["parsed_date"] = pd.to_datetime(sub["Date"], format="%d/%m/%Y", errors="coerce")
        sub = sub.dropna(subset=["parsed_date"])
        sub = sub[sub["parsed_date"].dt.year >= cutoff]
        sub = sub.sort_values("parsed_date")
        # Deduplicate by week keeping the last status seen
        sub = sub.drop_duplicates(subset=["Week"], keep="last")
        series[field] = [
            HistoricalRetailPoint(
                week_ending=row.parsed_date.date().isoformat(),
                price=round(float(row.Value), 2),
            )
            for row in sub.itertuples(index=False)
        ]

    return HistoricalRetail(
        regular_91=series["regular_91"],
        premium_95=series["premium_95"],
        diesel=series["diesel"],
    )


if __name__ == "__main__":
    import time

    t0 = time.time()
    w = fetch()
    c = w.components
    total = c.pre_tax + c.ets + c.excise + c.gst
    print(
        f"[mbie] ok fuel={w.fuel} week_ending={w.week_ending} "
        f"pre_tax={c.pre_tax} ets={c.ets} excise={c.excise} gst={c.gst} "
        f"sum={total:.2f} retail={w.adjusted_retail} "
        f"in {time.time() - t0:.1f}s"
    )
    if w.historical_split is not None:
        s = w.historical_split
        print(
            f"  historical split ({s.week_ending}): "
            f"importer_cost={s.importer_cost} margin={s.importer_margin}"
        )
