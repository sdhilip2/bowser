import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import * as d3 from "d3";

import type { FuelStocks, FuelStockBreakdown } from "../lib/snapshot";

interface Props {
  stocks: FuelStocks;
}

/* ──────────────────────────────────────────────────────────────
   Inline SVG icons — simple line-art, scale with text color
   ────────────────────────────────────────────────────────────── */

function PetrolPumpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="10" height="16" rx="1" />
      <line x1="3" y1="10" x2="13" y2="10" />
      <line x1="6" y1="7" x2="10" y2="7" />
      <path d="M13 12h2.5a1.5 1.5 0 011.5 1.5v4.5a2 2 0 104 0v-9l-3-3" />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 7h11v10H2z" />
      <path d="M13 11h4l4 3v3h-8" />
      <circle cx="6" cy="17.5" r="2" />
      <circle cx="17" cy="17.5" r="2" />
    </svg>
  );
}

function JetIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12l-8-4 -2 -6 -2 1 1 6 -7 -1 -2 2 7 3 -1 4 -2 1 3 1 1 3 1 -2 4 -1 3 -7 6 3 z" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   Stage colors — three distinct luminance levels on cream
   ────────────────────────────────────────────────────────────── */

const STAGE_COLOR = {
  in_country: "#3b2f2f", // near-black — most solid, "here now"
  eez_water: "#8b5e3c",  // coffee brown — "on the way"
  outside_eez: "#c8933e", // warm gold — "furthest, will take weeks"
} as const;

// Text color on top of each stage's background — picked for contrast.
// near-black + coffee need light text; gold needs dark text.
const STAGE_LABEL_COLOR = {
  in_country: "var(--surface-0)",
  eez_water: "var(--surface-0)",
  outside_eez: "var(--ink-100)",
} as const;

// Minimum segment width (px) needed to fit a "XX.Xd" label legibly
const MIN_LABEL_WIDTH = 40;

const STAGES = [
  {
    key: "in_country" as const,
    label: "in-country",
    description: "at NZ terminals, ready now",
  },
  {
    key: "eez_water" as const,
    label: "within eez",
    description: "on ships ≤2 days away",
  },
  {
    key: "outside_eez" as const,
    label: "outside eez",
    description: "on ships ≤3 weeks away",
  },
] as const;

interface Row {
  key: "petrol" | "diesel" | "jet";
  label: string;
  total: number;
  breakdown: FuelStockBreakdown;
  Icon: (props: { className?: string }) => JSX.Element;
}

function formatAsOf(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/* ──────────────────────────────────────────────────────────────
   D3 stacked horizontal bar chart
   ────────────────────────────────────────────────────────────── */

const MARGIN = { top: 20, right: 60, bottom: 48, left: 100 };
const CHART_HEIGHT = 380;

interface ChartProps {
  rows: Row[];
}

function StockBarChart({ rows }: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svgEl = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!wrap || !svgEl || !tooltip) return;

    const render = () => {
      const width = wrap.clientWidth;
      if (width === 0) return;

      const svg = d3.select(svgEl).attr("viewBox", `0 0 ${width} ${CHART_HEIGHT}`);
      svg.selectAll("*").remove();

      // x: days (linear) — add a little padding above the max
      const maxDays = d3.max(rows, (r) => r.total)! * 1.08;
      const x = d3
        .scaleLinear()
        .domain([0, maxDays])
        .range([MARGIN.left, width - MARGIN.right]);

      // y: band (one row per fuel)
      const y = d3
        .scaleBand<string>()
        .domain(rows.map((r) => r.key))
        .range([MARGIN.top, CHART_HEIGHT - MARGIN.bottom])
        .padding(0.25);

      // Baseline (x-axis line)
      svg
        .append("line")
        .attr("x1", MARGIN.left)
        .attr("x2", width - MARGIN.right)
        .attr("y1", CHART_HEIGHT - MARGIN.bottom)
        .attr("y2", CHART_HEIGHT - MARGIN.bottom)
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-width", 1);

      // Vertical gridlines at every 10 days
      const xTicks = d3.range(0, Math.ceil(maxDays / 10) * 10 + 1, 10);
      svg
        .append("g")
        .selectAll("line.grid")
        .data(xTicks)
        .enter()
        .append("line")
        .attr("class", "grid")
        .attr("x1", (d) => x(d))
        .attr("x2", (d) => x(d))
        .attr("y1", MARGIN.top)
        .attr("y2", CHART_HEIGHT - MARGIN.bottom)
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", "1 3");

      // X-axis tick marks
      svg
        .append("g")
        .selectAll("line.xtick")
        .data(xTicks)
        .enter()
        .append("line")
        .attr("class", "xtick")
        .attr("x1", (d) => x(d))
        .attr("x2", (d) => x(d))
        .attr("y1", CHART_HEIGHT - MARGIN.bottom)
        .attr("y2", CHART_HEIGHT - MARGIN.bottom + 5)
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-width", 1);

      // X-axis labels (days)
      svg
        .append("g")
        .selectAll("text.xlabel")
        .data(xTicks)
        .enter()
        .append("text")
        .attr("class", "xlabel")
        .attr("x", (d) => x(d))
        .attr("y", CHART_HEIGHT - MARGIN.bottom + 20)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--ink-40)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 10)
        .attr("letter-spacing", "0.06em")
        .text((d) => `${d}d`);

      // X-axis title
      svg
        .append("text")
        .attr("x", (MARGIN.left + (width - MARGIN.right)) / 2)
        .attr("y", CHART_HEIGHT - 8)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--ink-70)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 10)
        .attr("letter-spacing", "0.08em")
        .text("days of consumption");

      // Fuel row labels (y-axis)
      svg
        .append("g")
        .selectAll("text.ylabel")
        .data(rows)
        .enter()
        .append("text")
        .attr("class", "ylabel")
        .attr("x", MARGIN.left - 12)
        .attr("y", (d) => (y(d.key) ?? 0) + y.bandwidth() / 2)
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .attr("fill", "var(--ink-100)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 11)
        .attr("letter-spacing", "0.08em")
        .text((d) => d.label);

      // Bars — each fuel row has 3 stacked segments
      rows.forEach((row, rowIdx) => {
        const yPos = y(row.key) ?? 0;
        const bh = y.bandwidth();
        let runningDays = 0;

        STAGES.forEach((stage, stageIdx) => {
          const value = row.breakdown[stage.key];
          if (value <= 0) return;
          const barX = x(runningDays);
          const barWidth = x(runningDays + value) - x(runningDays);
          const segKey = `${row.key}-${stage.key}`;

          // The segment rect — animated grow from left
          svg
            .append("rect")
            .attr("class", "fs-seg")
            .attr("data-segment", segKey)
            .attr("x", barX)
            .attr("y", yPos)
            .attr("width", 0)
            .attr("height", bh)
            .attr("fill", STAGE_COLOR[stage.key])
            .attr("opacity", 0.95)
            .style("cursor", "crosshair")
            .transition()
            .delay(stageIdx * 100 + rowIdx * 80)
            .duration(900)
            .ease(d3.easeCubicOut)
            .attr("width", barWidth);

          // Inline segment label — appears after the bar has grown,
          // only if the segment is wide enough to contain it legibly.
          if (barWidth >= MIN_LABEL_WIDTH) {
            svg
              .append("text")
              .attr("class", "fs-seg-label")
              .attr("x", barX + barWidth / 2)
              .attr("y", yPos + bh / 2)
              .attr("dy", "0.32em")
              .attr("text-anchor", "middle")
              .attr("fill", STAGE_LABEL_COLOR[stage.key])
              .attr("font-family", "var(--font-mono)")
              .attr("font-size", 12)
              .attr("font-variant-numeric", "tabular-nums")
              .attr("pointer-events", "none")
              .attr("opacity", 0)
              .text(`${value.toFixed(1)}d`)
              .transition()
              .delay(stageIdx * 100 + rowIdx * 80 + 800)
              .duration(300)
              .attr("opacity", 1);
          }

          // Interaction handlers (add after transition starts)
          svg
            .select<SVGRectElement>(`rect[data-segment="${segKey}"]`)
            .on("mouseenter", function () {
              d3.select(this).attr("opacity", 1);
              tooltip.style.opacity = "1";
            })
            .on("mouseleave", function () {
              d3.select(this).attr("opacity", 0.95);
              tooltip.style.opacity = "0";
            })
            .on("mousemove", function (event: MouseEvent) {
              const pct = ((value / row.total) * 100).toFixed(0);
              tooltip.textContent = "";
              const header = document.createElement("div");
              header.className = "tt-date";
              header.textContent = `${row.label} · ${stage.label}`;
              tooltip.append(header);
              const val = document.createElement("div");
              val.className = "tt-val mono";
              val.textContent = `${value.toFixed(1)} days`;
              val.style.color = "var(--ink-100)";
              tooltip.append(val);
              const pctEl = document.createElement("div");
              pctEl.className = "caption";
              pctEl.style.marginTop = "4px";
              pctEl.textContent = `${pct}% of ${row.label} total`;
              tooltip.append(pctEl);

              const wrapRect = wrap.getBoundingClientRect();
              const pixelX = event.clientX - wrapRect.left;
              const pixelY = event.clientY - wrapRect.top;
              const ttW = tooltip.offsetWidth || 200;
              const ttH = tooltip.offsetHeight || 80;
              let left = pixelX + 14;
              if (left + ttW > wrap.clientWidth - 8) left = pixelX - ttW - 14;
              const top = Math.max(8, Math.min(pixelY - ttH - 10, CHART_HEIGHT - ttH - 8));
              tooltip.style.left = `${left}px`;
              tooltip.style.top = `${top}px`;
            });

          runningDays += value;
        });

        // Total label at the end of each bar
        svg
          .append("text")
          .attr("x", x(row.total) + 6)
          .attr("y", yPos + bh / 2)
          .attr("dy", "0.32em")
          .attr("fill", "var(--ink-100)")
          .attr("font-family", "var(--font-mono)")
          .attr("font-size", 12)
          .attr("font-variant-numeric", "tabular-nums")
          .attr("opacity", 0)
          .text(`${row.total.toFixed(1)}d`)
          .transition()
          .delay(700 + rowIdx * 80)
          .duration(400)
          .attr("opacity", 1);
      });
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [rows]);

  return (
    <div className="fs-chart" ref={wrapRef}>
      <svg
        ref={svgRef}
        style={{ display: "block", width: "100%", height: CHART_HEIGHT }}
      />
      <div ref={tooltipRef} className="crude-tooltip fs-chart-tooltip" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Main component
   ────────────────────────────────────────────────────────────── */

export function FuelSupply({ stocks }: Props) {
  const rows: Row[] = [
    {
      key: "petrol",
      label: "petrol",
      total: stocks.petrol_days,
      breakdown: stocks.petrol_breakdown,
      Icon: PetrolPumpIcon,
    },
    {
      key: "diesel",
      label: "diesel",
      total: stocks.diesel_days,
      breakdown: stocks.diesel_breakdown,
      Icon: TruckIcon,
    },
    {
      key: "jet",
      label: "jet fuel",
      total: stocks.jet_days,
      breakdown: stocks.jet_breakdown,
      Icon: JetIcon,
    },
  ];

  return (
    <section className="fuelsupply">
      <header className="section-header">
        <p className="caption">
          <a
            href="https://www.mbie.govt.nz/about/news/fuel-stocks-update"
            target="_blank"
            rel="noreferrer"
          >
            mbie fuel stocks
          </a>
          {" · days of cover · as at "}
          {formatAsOf(stocks.as_of)}
        </p>
        <h2>How long New Zealand's fuel lasts.</h2>
        <p className="fs-intro">
          Most of NZ's fuel arrives by sea. MBIE splits the national stock
          into three stages: fuel already at domestic terminals (ready now),
          fuel on ships inside our Exclusive Economic Zone — 200 nautical
          miles from the coast, arriving within about 2 days — and fuel on
          ships still in international waters, up to about 3 weeks away.
        </p>
      </header>

      <div className="fs-stats">
        {rows.map((r, i) => (
          <motion.div
            key={r.key}
            className="fs-stat"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="caption fs-stat-label">
              <r.Icon className="fs-stat-icon" />
              {r.label}
            </p>
            <p className="fs-stat-value mono">
              {r.total.toFixed(1)}
              <span className="fs-stat-unit">days</span>
            </p>
          </motion.div>
        ))}
      </div>

      {/* Legend (centered, above the bars) */}
      <div className="fs-legend">
        <span className="fs-legend-item">
          <span
            className="fs-swatch"
            style={{ background: STAGE_COLOR.in_country }}
          />
          <span className="caption">
            in-country — at NZ terminals, ready now
          </span>
        </span>
        <span className="fs-legend-item">
          <span
            className="fs-swatch"
            style={{ background: STAGE_COLOR.eez_water }}
          />
          <span className="caption">
            within eez — {stocks.ships_in_eez} ships, ≤2 days away
          </span>
        </span>
        <span className="fs-legend-item">
          <span
            className="fs-swatch"
            style={{ background: STAGE_COLOR.outside_eez }}
          />
          <span className="caption">
            outside eez — {stocks.ships_outside_eez} ships, ≤3 weeks away
          </span>
        </span>
      </div>

      <StockBarChart rows={rows} />

      <table className="fs-table">
        <thead>
          <tr>
            <th></th>
            <th className="caption">petrol</th>
            <th className="caption">diesel</th>
            <th className="caption">jet</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="caption fs-table-cat">
              in-country
              <span className="fs-table-hint">at nz terminals</span>
            </td>
            <td className="mono">{stocks.petrol_breakdown.in_country.toFixed(1)}d</td>
            <td className="mono">{stocks.diesel_breakdown.in_country.toFixed(1)}d</td>
            <td className="mono">{stocks.jet_breakdown.in_country.toFixed(1)}d</td>
          </tr>
          <tr>
            <td className="caption fs-table-cat">
              within eez
              <span className="fs-table-hint">
                {stocks.ships_in_eez} ships · ≤2 days away
              </span>
            </td>
            <td className="mono">{stocks.petrol_breakdown.eez_water.toFixed(1)}d</td>
            <td className="mono">{stocks.diesel_breakdown.eez_water.toFixed(1)}d</td>
            <td className="mono">{stocks.jet_breakdown.eez_water.toFixed(1)}d</td>
          </tr>
          <tr>
            <td className="caption fs-table-cat">
              outside eez
              <span className="fs-table-hint">
                {stocks.ships_outside_eez} ships · ≤3 weeks away
              </span>
            </td>
            <td className="mono">{stocks.petrol_breakdown.outside_eez.toFixed(1)}d</td>
            <td className="mono">{stocks.diesel_breakdown.outside_eez.toFixed(1)}d</td>
            <td className="mono">{stocks.jet_breakdown.outside_eez.toFixed(1)}d</td>
          </tr>
          <tr className="fs-table-total">
            <td className="caption">total</td>
            <td className="mono">{stocks.petrol_days.toFixed(1)}d</td>
            <td className="mono">{stocks.diesel_days.toFixed(1)}d</td>
            <td className="mono">{stocks.jet_days.toFixed(1)}d</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
