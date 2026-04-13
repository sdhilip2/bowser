import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

import type { HistoricalRetail, HistoricalRetailPoint } from "../lib/snapshot";

interface Props {
  history: HistoricalRetail;
  height?: number;
}

interface Parsed {
  date: Date;
  price: number; // in NZ cents/L
}

const MARGIN = { top: 28, right: 84, bottom: 44, left: 12 };

// Three warm tones deliberately picked for cream-background legibility.
// Labels match the pump card text (regular 91 / premium 95 / diesel) so
// readers have one mental model across the whole section — no bare
// numbers that require NZ-fuel literacy to decode.
const SERIES_META = [
  { key: "regular_91", label: "regular 91", color: "#c8933e" },  // warm gold
  { key: "premium_95", label: "premium 95", color: "#8b5e3c" },  // coffee brown
  { key: "diesel", label: "diesel", color: "#3b2f2f" },          // near-black
] as const;

function parse(points: HistoricalRetailPoint[]): Parsed[] {
  return points
    .map((p) => ({ date: new Date(p.week_ending), price: p.price }))
    .filter((p) => !Number.isNaN(p.date.getTime()));
}

function appendTooltipRow(
  tooltip: HTMLDivElement,
  color: string,
  label: string,
  centsPerL: number,
) {
  const row = document.createElement("div");
  row.className = "tt-row-simple";
  const swatch = document.createElement("span");
  swatch.className = "tt-swatch";
  swatch.style.background = color;
  const lab = document.createElement("span");
  lab.className = "tt-label";
  lab.textContent = label.toLowerCase();
  const val = document.createElement("span");
  val.className = "tt-val mono";
  val.textContent = `$${(centsPerL / 100).toFixed(3)}/L`;
  row.append(swatch, lab, val);
  tooltip.append(row);
}

export function RetailTrendChart({ history, height = 420 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [selectedYear, setSelectedYear] = useState<string>("all");

  // Distinct years present in the data, newest-first
  const years = useMemo(() => {
    const set = new Set<string>();
    history.regular_91.forEach((p) => set.add(p.week_ending.slice(0, 4)));
    return Array.from(set).sort().reverse();
  }, [history]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svgEl = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!wrap || !svgEl || !tooltip) return;

    const filterByYear = (points: HistoricalRetailPoint[]) => {
      if (selectedYear === "all") return points;
      return points.filter((p) => p.week_ending.startsWith(selectedYear));
    };

    const series = SERIES_META.map((m) => ({
      ...m,
      data: parse(filterByYear(history[m.key])),
    })).filter((s) => s.data.length > 0);

    if (series.length === 0) return;

    const render = () => {
      const width = wrap.clientWidth;
      if (width === 0) return;

      const all = series.flatMap((s) => s.data);
      const xDomain = d3.extent(all, (d) => d.date) as [Date, Date];

      const x = d3
        .scaleTime()
        .domain(xDomain)
        .range([MARGIN.left, width - MARGIN.right]);

      const yMin = d3.min(all, (d) => d.price)! * 0.95;
      const yMax = d3.max(all, (d) => d.price)! * 1.05;
      const y = d3
        .scaleLinear()
        .domain([yMin, yMax])
        .range([height - MARGIN.bottom, MARGIN.top]);

      const line = d3
        .line<Parsed>()
        .x((d) => x(d.date))
        .y((d) => y(d.price))
        .curve(d3.curveMonotoneX);

      const svg = d3.select(svgEl).attr("viewBox", `0 0 ${width} ${height}`);
      svg.selectAll("*").remove();

      // Gridlines
      const yTicks = y.ticks(5);
      svg
        .append("g")
        .selectAll("line")
        .data(yTicks)
        .enter()
        .append("line")
        .attr("x1", MARGIN.left)
        .attr("x2", width - MARGIN.right)
        .attr("y1", (d) => y(d))
        .attr("y2", (d) => y(d))
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-width", 1);

      // Right-side price labels — formatted as $X.XX/L
      svg
        .append("g")
        .selectAll("text")
        .data(yTicks)
        .enter()
        .append("text")
        .attr("x", width - MARGIN.right + 10)
        .attr("y", (d) => y(d))
        .attr("dy", "0.32em")
        .attr("fill", "var(--ink-40)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 10)
        .attr("font-variant-numeric", "tabular-nums")
        .text((d) => `$${(d / 100).toFixed(2)}`);

      // X-axis baseline
      svg
        .append("line")
        .attr("x1", MARGIN.left)
        .attr("x2", width - MARGIN.right)
        .attr("y1", height - MARGIN.bottom)
        .attr("y2", height - MARGIN.bottom)
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-width", 1);

      // X-axis ticks — years for the all-years view, months for a single
      // year. The plot width is wide enough to fit 10 year labels OR 12
      // month labels comfortably, so we just swap the time interval and
      // the label format based on the selected filter.
      const xTickInterval =
        selectedYear === "all"
          ? d3.timeYear.every(1) ?? d3.timeYear
          : d3.timeMonth.every(1) ?? d3.timeMonth;
      const xTicks = x.ticks(xTickInterval);
      const xTickFmt =
        selectedYear === "all" ? d3.timeFormat("%Y") : d3.timeFormat("%B");

      svg
        .append("g")
        .selectAll("line")
        .data(xTicks)
        .enter()
        .append("line")
        .attr("x1", (d) => x(d))
        .attr("x2", (d) => x(d))
        .attr("y1", height - MARGIN.bottom)
        .attr("y2", height - MARGIN.bottom + 5)
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-width", 1);

      svg
        .append("g")
        .selectAll("text")
        .data(xTicks)
        .enter()
        .append("text")
        .attr("x", (d) => x(d))
        .attr("y", height - MARGIN.bottom + 22)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--ink-40)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 10)
        .attr("letter-spacing", "0.08em")
        .text((d) => xTickFmt(d).toLowerCase());

      // Lines with draw-in. End-of-line labels intentionally omitted —
      // the top-center legend identifies each series, so inline labels
      // would just duplicate information.
      series.forEach(({ data, color }, i) => {
        const path = svg
          .append("path")
          .datum(data)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("stroke-linejoin", "round")
          .attr("d", line);

        const totalLength = (path.node() as SVGPathElement).getTotalLength();
        path
          .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
          .attr("stroke-dashoffset", totalLength)
          .transition()
          .duration(1400)
          .delay(i * 120)
          .ease(d3.easeCubicOut)
          .attr("stroke-dashoffset", 0);
      });

      // Crosshair + focus dots + tooltip
      const focus = svg.append("g").style("display", "none");
      focus
        .append("line")
        .attr("class", "crosshair-v")
        .attr("y1", MARGIN.top)
        .attr("y2", height - MARGIN.bottom)
        .attr("stroke", "var(--amber-500)")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2 3");

      const focusDots = series.map(({ color }) =>
        focus
          .append("circle")
          .attr("r", 4)
          .attr("fill", "var(--surface-0)")
          .attr("stroke", color)
          .attr("stroke-width", 2),
      );

      // No on-axis hover date label — it would collide with the permanent
      // year/month ticks at the same y-position. The tooltip box header
      // already shows the full date in amber, which is where the reader's
      // attention is while hovering anyway.

      const bisect = d3.bisector<Parsed, Date>((d) => d.date).left;
      // Full month names in tooltip regardless of filter — "15 March 2022"
      const fmtDate = d3.timeFormat("%d %B %Y");

      const nearest = (data: Parsed[], date: Date): Parsed => {
        const i = bisect(data, date);
        const a = data[Math.max(0, i - 1)];
        const b = data[Math.min(data.length - 1, i)];
        if (!a) return b;
        if (!b) return a;
        return date.getTime() - a.date.getTime() < b.date.getTime() - date.getTime()
          ? a
          : b;
      };

      const hit = svg
        .append("rect")
        .attr("x", MARGIN.left)
        .attr("y", MARGIN.top)
        .attr("width", width - MARGIN.left - MARGIN.right)
        .attr("height", height - MARGIN.top - MARGIN.bottom)
        .attr("fill", "transparent")
        .style("cursor", "crosshair");

      hit.on("mouseenter", () => {
        focus.style("display", null);
        tooltip.style.opacity = "1";
      });
      hit.on("mouseleave", () => {
        focus.style("display", "none");
        tooltip.style.opacity = "0";
      });

      hit.on("mousemove", (event: MouseEvent) => {
        const [mx] = d3.pointer(event, svgEl);
        const date = x.invert(mx);

        const snapshots = series.map((s) => nearest(s.data, date));
        const anchor = snapshots[0];
        const ax = x(anchor.date);

        focus.select<SVGLineElement>(".crosshair-v").attr("x1", ax).attr("x2", ax);
        snapshots.forEach((pt, i) => {
          focusDots[i].attr("cx", x(pt.date)).attr("cy", y(pt.price));
        });

        tooltip.textContent = "";
        const header = document.createElement("div");
        header.className = "tt-date";
        header.textContent = fmtDate(anchor.date);
        tooltip.append(header);
        series.forEach((s, i) => {
          appendTooltipRow(tooltip, s.color, s.label, snapshots[i].price);
        });

        const svgRect = svgEl.getBoundingClientRect();
        const scaleX = svgRect.width / width;
        const wrapRect = wrap.getBoundingClientRect();
        const pixelX = ax * scaleX + (svgRect.left - wrapRect.left);
        const pixelY = y(anchor.price) * scaleX + (svgRect.top - wrapRect.top);
        const ttW = tooltip.offsetWidth || 200;
        const ttH = tooltip.offsetHeight || 100;
        let left = pixelX + 16;
        if (left + ttW > wrap.clientWidth - 8) left = pixelX - ttW - 16;
        const top = Math.max(8, Math.min(pixelY - ttH / 2, height - ttH - 8));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      });
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [history, height, selectedYear]);

  return (
    <div className="crudechart retailchart" ref={wrapRef}>
      <div className="chart-legend chart-legend-center">
        {SERIES_META.map((s) => (
          <span key={s.key} className="legend-item">
            <span className="legend-line" style={{ background: s.color }} />
            {s.label.toLowerCase()}
          </span>
        ))}
      </div>
      <select
        className="year-filter"
        value={selectedYear}
        onChange={(e) => setSelectedYear(e.target.value)}
        aria-label="Filter by year"
      >
        <option value="all">all years</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <svg ref={svgRef} style={{ display: "block", width: "100%", height }} />
      <div ref={tooltipRef} className="crude-tooltip" />
    </div>
  );
}
