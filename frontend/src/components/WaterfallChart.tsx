import { useEffect, useRef } from "react";
import * as d3 from "d3";

import type { MBIEWaterfall } from "../lib/snapshot";
import { formatCents, formatDateShort } from "../lib/format";

interface Props {
  waterfall: MBIEWaterfall;
}

interface Bar {
  key: string;
  label: string;
  value: number;
  start: number;     // running total before this bar
  end: number;       // running total after this bar
  kind: "pretax" | "tax" | "total";
}

function buildBars(w: MBIEWaterfall): Bar[] {
  const c = w.components;
  let running = 0;
  const steps: Omit<Bar, "start" | "end">[] = [
    { key: "pretax", label: "pre-tax", value: c.pre_tax, kind: "pretax" },
    { key: "ets", label: "ets", value: c.ets, kind: "tax" },
    { key: "excise", label: "excise", value: c.excise, kind: "tax" },
    { key: "gst", label: "gst", value: c.gst, kind: "tax" },
  ];
  const bars: Bar[] = steps.map((step) => {
    const start = running;
    running += step.value;
    return { ...step, start, end: running };
  });
  // Retail total bar — rises from zero to the full adjusted retail
  bars.push({
    key: "retail",
    label: "adjusted retail",
    value: w.adjusted_retail,
    start: 0,
    end: w.adjusted_retail,
    kind: "total",
  });
  return bars;
}

const MARGIN = { top: 72, right: 48, bottom: 72, left: 48 };
const HEIGHT = 520;

export function WaterfallChart({ waterfall }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svgEl = svgRef.current;
    if (!wrap || !svgEl) return;

    const render = () => {
      const width = wrap.clientWidth;
      if (width === 0) return;

      const bars = buildBars(waterfall);
      const maxVal = d3.max(bars, (b) => b.end)! * 1.08;

      const x = d3
        .scaleBand<string>()
        .domain(bars.map((b) => b.key))
        .range([MARGIN.left, width - MARGIN.right])
        .padding(0.25);

      const y = d3
        .scaleLinear()
        .domain([0, maxVal])
        .range([HEIGHT - MARGIN.bottom, MARGIN.top]);

      const svg = d3.select(svgEl).attr("viewBox", `0 0 ${width} ${HEIGHT}`);
      svg.selectAll("*").remove();

      // Baseline
      svg
        .append("line")
        .attr("x1", MARGIN.left - 8)
        .attr("x2", width - MARGIN.right + 8)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-width", 1);

      // Y tick lines (very subtle)
      const yTicks = y.ticks(4);
      svg
        .append("g")
        .selectAll("line")
        .data(yTicks.slice(1))
        .enter()
        .append("line")
        .attr("x1", MARGIN.left)
        .attr("x2", width - MARGIN.right)
        .attr("y1", (d) => y(d))
        .attr("y2", (d) => y(d))
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", "1 3");

      svg
        .append("g")
        .selectAll("text")
        .data(yTicks.slice(1))
        .enter()
        .append("text")
        .attr("x", MARGIN.left - 12)
        .attr("y", (d) => y(d))
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .attr("fill", "var(--ink-40)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 10)
        .attr("font-variant-numeric", "tabular-nums")
        .text((d) => `${d}c`);

      // Connector lines (before bars so bars sit on top when they grow)
      const connectorGroup = svg.append("g").attr("class", "connectors");
      bars.forEach((bar, i) => {
        if (i === 0 || bar.key === "retail") return;
        const prev = bars[i - 1];
        if (prev.key === "retail") return;
        connectorGroup
          .append("line")
          .attr("x1", x(prev.key)! + x.bandwidth())
          .attr("x2", x(bar.key)!)
          .attr("y1", y(prev.end))
          .attr("y2", y(prev.end))
          .attr("stroke", "var(--ink-40)")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "2 3")
          .attr("opacity", 0)
          .transition()
          .delay(800 + i * 60)
          .duration(400)
          .attr("opacity", 0.6);
      });

      // Bars — grow from baseline
      const colorFor = (kind: Bar["kind"]) => {
        if (kind === "total") return "var(--ink-100)";
        if (kind === "pretax") return "var(--amber-500)";
        return "var(--ink-70)";
      };

      bars.forEach((bar, i) => {
        const bx = x(bar.key)!;
        const bw = x.bandwidth();
        const yTop = y(bar.end);
        const yBot = y(bar.start);
        const h = yBot - yTop;

        svg
          .append("rect")
          .attr("x", bx)
          .attr("y", yBot) // start at bottom
          .attr("width", bw)
          .attr("height", 0)
          .attr("fill", colorFor(bar.kind))
          .attr("opacity", bar.kind === "total" ? 1 : 0.95)
          .transition()
          .delay(i * 60)
          .duration(900)
          .ease(d3.easeCubicOut)
          .attr("y", yTop)
          .attr("height", h);

        // Running total above each bar (mono, tabular)
        svg
          .append("text")
          .attr("x", bx + bw / 2)
          .attr("y", yTop - 10)
          .attr("text-anchor", "middle")
          .attr("fill", bar.kind === "total" ? "var(--amber-500)" : "var(--ink-100)")
          .attr("font-family", "var(--font-mono)")
          .attr("font-size", bar.kind === "total" ? 14 : 12)
          .attr("font-variant-numeric", "tabular-nums")
          .attr("opacity", 0)
          .text(formatCents(bar.end))
          .transition()
          .delay(i * 60 + 700)
          .duration(400)
          .attr("opacity", 1);

        // Segment value (inside bar if tall enough, else under)
        const insideLabel = h > 36;
        svg
          .append("text")
          .attr("x", bx + bw / 2)
          .attr("y", insideLabel ? yTop + 18 : yBot + 16)
          .attr("text-anchor", "middle")
          .attr(
            "fill",
            insideLabel && bar.kind === "pretax"
              ? "var(--surface-0)"
              : "var(--ink-40)"
          )
          .attr("font-family", "var(--font-mono)")
          .attr("font-size", 10)
          .attr("opacity", 0)
          .text(bar.kind === "total" ? "" : `+${bar.value.toFixed(2)}`)
          .transition()
          .delay(i * 60 + 900)
          .duration(300)
          .attr("opacity", 1);

        // X-axis label
        svg
          .append("text")
          .attr("x", bx + bw / 2)
          .attr("y", HEIGHT - MARGIN.bottom + 24)
          .attr("text-anchor", "middle")
          .attr("fill", "var(--ink-70)")
          .attr("font-family", "var(--font-mono)")
          .attr("font-size", 10)
          .attr("letter-spacing", "0.06em")
          .text(bar.label);
      });
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [waterfall]);

  return (
    <section className="waterfall">
      <header className="waterfall-header container">
        <p className="caption">
          <a
            href="https://www.mbie.govt.nz/building-and-energy/energy-and-natural-resources/energy-statistics-and-modelling/energy-statistics/weekly-fuel-price-monitoring"
            target="_blank"
            rel="noreferrer"
          >
            mbie weekly fuel monitoring
          </a>
          {" · "}
          {waterfall.fuel.toLowerCase()} · week ending{" "}
          {formatDateShort(waterfall.week_ending)}
        </p>
        <h2>Where your pump dollar goes.</h2>
      </header>
      <div className="waterfall-wrap" ref={wrapRef}>
        <div className="chart-legend chart-legend-center waterfall-legend">
          <span className="legend-item">
            <span
              className="legend-chip"
              style={{ background: "var(--amber-500)" }}
            />
            pre-tax
          </span>
          <span className="legend-item">
            <span
              className="legend-chip"
              style={{ background: "var(--ink-70)" }}
            />
            tax
          </span>
          <span className="legend-item">
            <span
              className="legend-chip"
              style={{ background: "var(--ink-100)" }}
            />
            retail total
          </span>
        </div>
        <svg
          ref={svgRef}
          style={{ display: "block", width: "100%", height: HEIGHT }}
        />
      </div>
      <p className="caption waterfall-footnote container">
        each bar is an additive component of the adjusted retail price in nzd
        c/L. pre-tax + ets + excise + gst ={" "}
        <span className="mono">{waterfall.adjusted_retail.toFixed(2)}c</span>.
        {waterfall.historical_split && (
          <>
            {" "}when mbie finalised the last complete week (
            {formatDateShort(waterfall.historical_split.week_ending)}), the
            pre-tax portion split as{" "}
            <span className="mono">
              importer cost {waterfall.historical_split.importer_cost.toFixed(1)}¢
            </span>
            {" + "}
            <span className="mono">
              margin {waterfall.historical_split.importer_margin.toFixed(1)}¢
            </span>
            . final importer cost and margin for the week above will be
            published by mbie 2–4 months from now.
          </>
        )}
      </p>
    </section>
  );
}
