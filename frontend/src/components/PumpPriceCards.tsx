import { motion } from "framer-motion";

import type {
  NZRetail,
  HistoricalRetail,
  FuelSummary,
  HistoricalRetailPoint,
} from "../lib/snapshot";
import { FuelSparkChart } from "./FuelSparkChart";

interface Props {
  retail: NZRetail;
  history: HistoricalRetail;
}

type FuelKey = "regular_91" | "premium_95" | "diesel";

interface FuelCard {
  key: FuelKey;
  label: string;
  kind: "petrol" | "diesel";
  /** Matches --brent / --amber-300 / --wti in tokens.css — picked for
   *  cream-background legibility in the 10-year chart, reused here so
   *  the small row charts feel like a visual family. */
  color: string;
}

// Only fuels MBIE tracks weekly — so every card has a real delta and a
// real chart. CardLink's 98 data is still fetched and available in
// snapshot.json.nz_retail.premium_98 for future use.
const FUELS: FuelCard[] = [
  { key: "regular_91", label: "regular 91", kind: "petrol", color: "#c8933e" },
  { key: "premium_95", label: "premium 95", kind: "petrol", color: "#8b5e3c" },
  { key: "diesel",     label: "diesel",     kind: "diesel", color: "#3b2f2f" },
];

function formatAsOf(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface DeltaInfo {
  cents: number;
  pct: number;
}

function computeDelta(points: HistoricalRetailPoint[]): DeltaInfo | null {
  if (points.length < 5) return null;
  const latest = points[points.length - 1].price;
  const fourWeeksAgo = points[points.length - 5].price;
  if (fourWeeksAgo === 0) return null;
  return {
    cents: latest - fourWeeksAgo,
    pct: ((latest - fourWeeksAgo) / fourWeeksAgo) * 100,
  };
}

function DeltaBadge({ delta }: { delta: DeltaInfo | null }) {
  if (delta === null) {
    return <p className="pumpcard-delta mono muted">—</p>;
  }
  const up = delta.cents >= 0;
  const sign = up ? "+" : "";
  const arrow = up ? "▲" : "▼";
  return (
    <p className={`pumpcard-delta mono ${up ? "delta-up" : "delta-down"}`}>
      <span className="delta-arrow">{arrow}</span>
      {sign}
      {delta.cents.toFixed(1)}¢
      <span className="delta-sep"> · </span>
      {sign}
      {delta.pct.toFixed(1)}%
      <span className="delta-window"> vs 4wk</span>
    </p>
  );
}

function SpreadLine({ summary }: { summary: FuelSummary }) {
  if (summary.count === 0) return null;
  return (
    <p className="caption pumpcard-spread">
      <span className="spread-num mono">${summary.min.toFixed(3)}</span>
      <span className="spread-sep"> — </span>
      <span className="spread-num mono">${summary.max.toFixed(3)}</span>
      <span className="spread-n"> · {summary.count} obs</span>
    </p>
  );
}

export function PumpPriceCards({ retail, history }: Props) {
  const lastMbieWeek = history.regular_91.length > 0
    ? history.regular_91[history.regular_91.length - 1].week_ending
    : "";
  return (
    <section className="pumpcards">
      <header className="section-header">
        <p className="caption">nz retail fuel prices</p>
        <h2>At the pump, right now.</h2>
      </header>
      <div className="pump-columns-header">
        <p className="caption pump-col-caption">
          today{retail.as_of ? ` · as at ${formatAsOf(retail.as_of)}` : ""}
          {" · source: "}
          <a
            href="https://www.pricewatch.co.nz"
            target="_blank"
            rel="noreferrer"
          >
            cardlink pricewatch
          </a>
        </p>
        <p className="caption pump-col-caption">
          last 12 weeks
          {lastMbieWeek ? ` · to week ending ${formatAsOf(lastMbieWeek)}` : ""}
          {" · source: "}
          <a
            href="https://www.mbie.govt.nz/building-and-energy/energy-and-natural-resources/energy-statistics-and-modelling/energy-statistics/weekly-fuel-price-monitoring"
            target="_blank"
            rel="noreferrer"
          >
            mbie weekly retail
          </a>
        </p>
      </div>
      <div className="pump-rows">
        {FUELS.map((f, i) => {
          const summary = retail[f.key];
          const delta = computeDelta(history[f.key]);
          return (
            <motion.div
              key={f.key}
              className="pump-row"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.15 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <article className="pumpcard">
                <p className="caption pumpcard-label">
                  {f.label}
                  <span className={`pumpcard-kind pumpcard-kind-${f.kind}`}>
                    {f.kind}
                  </span>
                </p>
                <p className="pumpcard-value mono">
                  ${summary.avg.toFixed(3)}
                  <span className="pumpcard-unit">/L</span>
                </p>
                <DeltaBadge delta={delta} />
                <SpreadLine summary={summary} />
              </article>
              <div className="pump-row-chart">
                <FuelSparkChart data={history[f.key]} color={f.color} weeks={12} />
              </div>
            </motion.div>
          );
        })}
      </div>
      <p className="caption pumpcards-footnote">
        prices shown are fuel-card transaction averages from cardlink
        pricewatch, aggregated daily from {retail.observations_today +
          retail.observations_yesterday +
          retail.observations_older}{" "}
        brand × region observations across 19 nz regions. the row charts
        are mbie weekly retail prices over the last 12 weeks — each fuel
        on its own y-axis so its movement reads cleanly.
        {" for live station-level prices, visit "}
        <a href="https://gaspy.nz" target="_blank" rel="noreferrer">
          gaspy.nz
        </a>
        {" — independent cross-checks between cardlink and gaspy typically agree within 1¢."}
      </p>
    </section>
  );
}
