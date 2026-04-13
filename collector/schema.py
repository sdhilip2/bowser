"""Pydantic models for snapshot.json — strict shape per CLAUDE.md §7."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class FX(BaseModel):
    nzd_per_usd: float
    as_of: str


class CrudePoint(BaseModel):
    date: str
    usd: float


class CrudeSeries(BaseModel):
    latest: float
    latest_date: str
    delta_1d_pct: float   # change vs previous trading day (weekends skipped)
    delta_30d_pct: float  # change vs 30 trading days ago (~6 calendar weeks)
    series: list[CrudePoint]


class Crude(BaseModel):
    brent: CrudeSeries
    wti: CrudeSeries


class FuelSummary(BaseModel):
    """CardLink per-fuel roll-up: min/avg/max in NZ dollars/L plus observation count."""
    avg: float
    min: float
    max: float
    count: int


class NZRetail(BaseModel):
    """NZ retail fuel prices from CardLink PriceWatch (fuel-card transactions)."""
    as_of: str
    regular_91: FuelSummary
    premium_95: FuelSummary
    premium_98: FuelSummary
    diesel: FuelSummary
    lpg: FuelSummary
    observations_today: int
    observations_yesterday: int
    observations_older: int


class WaterfallComponents(BaseModel):
    """Four components that MBIE publishes in EVERY week (including Provisional).
    `pre_tax` combines what MBIE splits as importer cost + importer margin once
    the week finalises — it's the non-tax portion of the retail price."""
    pre_tax: float
    ets: float
    excise: float
    gst: float


class HistoricalSplit(BaseModel):
    """Most recent Final week's split of the pre_tax component into importer
    cost vs importer margin. Displayed as supporting context in the waterfall
    footnote so readers can still see the cost/margin ratio even when the
    main chart shows a fresher Provisional week."""
    week_ending: str
    importer_cost: float
    importer_margin: float


class MBIEWaterfall(BaseModel):
    week_ending: str
    fuel: Literal["Regular Petrol", "Premium Petrol 95R", "Diesel"]
    components: WaterfallComponents
    adjusted_retail: float
    historical_split: HistoricalSplit | None


class HistoricalRetailPoint(BaseModel):
    week_ending: str
    price: float


class HistoricalRetail(BaseModel):
    regular_91: list[HistoricalRetailPoint] = Field(default_factory=list)
    premium_95: list[HistoricalRetailPoint] = Field(default_factory=list)
    diesel: list[HistoricalRetailPoint] = Field(default_factory=list)


class FuelStockBreakdown(BaseModel):
    in_country: float
    eez_water: float
    outside_eez: float


class FuelStocks(BaseModel):
    as_of: str
    published: str
    petrol_days: float
    diesel_days: float
    jet_days: float
    petrol_breakdown: FuelStockBreakdown
    diesel_breakdown: FuelStockBreakdown
    jet_breakdown: FuelStockBreakdown
    ships_in_eez: int
    ships_outside_eez: int


class NewsItem(BaseModel):
    title: str
    source: str
    published: str
    url: str


class News(BaseModel):
    nz: list[NewsItem] = Field(default_factory=list)
    global_: list[NewsItem] = Field(default_factory=list, alias="global")

    model_config = {"populate_by_name": True}


class Snapshot(BaseModel):
    generated_at: str
    fx: FX
    crude: Crude
    nz_retail: NZRetail | None
    mbie_waterfall: MBIEWaterfall
    historical_retail: HistoricalRetail
    fuel_stocks: FuelStocks | None
    news: News
