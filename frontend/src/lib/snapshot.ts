export interface FX {
  nzd_per_usd: number;
  as_of: string;
}

export interface CrudePoint {
  date: string;
  usd: number;
}

export interface CrudeSeries {
  latest: number;
  latest_date: string;
  delta_1d_pct: number;
  delta_30d_pct: number;
  series: CrudePoint[];
}

export interface Crude {
  brent: CrudeSeries;
  wti: CrudeSeries;
}

export interface FuelSummary {
  avg: number;   // NZ dollars/L
  min: number;
  max: number;
  count: number;
}

export interface NZRetail {
  as_of: string;
  regular_91: FuelSummary;
  premium_95: FuelSummary;
  premium_98: FuelSummary;
  diesel: FuelSummary;
  lpg: FuelSummary;
  observations_today: number;
  observations_yesterday: number;
  observations_older: number;
}

export interface WaterfallComponents {
  pre_tax: number;
  ets: number;
  excise: number;
  gst: number;
}

export interface HistoricalSplit {
  week_ending: string;
  importer_cost: number;
  importer_margin: number;
}

export type FuelLabel = "Regular Petrol" | "Premium Petrol 95R" | "Diesel";

export interface MBIEWaterfall {
  week_ending: string;
  fuel: FuelLabel;
  components: WaterfallComponents;
  adjusted_retail: number;
  historical_split: HistoricalSplit | null;
}

export interface HistoricalRetailPoint {
  week_ending: string;
  price: number;
}

export interface HistoricalRetail {
  regular_91: HistoricalRetailPoint[];
  premium_95: HistoricalRetailPoint[];
  diesel: HistoricalRetailPoint[];
}

export interface FuelStockBreakdown {
  in_country: number;
  eez_water: number;
  outside_eez: number;
}

export interface FuelStocks {
  as_of: string;
  published: string;
  petrol_days: number;
  diesel_days: number;
  jet_days: number;
  petrol_breakdown: FuelStockBreakdown;
  diesel_breakdown: FuelStockBreakdown;
  jet_breakdown: FuelStockBreakdown;
  ships_in_eez: number;
  ships_outside_eez: number;
}

export interface NewsItem {
  title: string;
  source: string;
  published: string;
  url: string;
}

export interface News {
  nz: NewsItem[];
  global: NewsItem[];
}

export interface Snapshot {
  generated_at: string;
  fx: FX;
  crude: Crude;
  nz_retail: NZRetail | null;
  mbie_waterfall: MBIEWaterfall;
  historical_retail: HistoricalRetail;
  fuel_stocks: FuelStocks | null;
  news: News;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const res = await fetch("/data/snapshot.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`snapshot fetch failed: ${res.status}`);
  }
  return (await res.json()) as Snapshot;
}
