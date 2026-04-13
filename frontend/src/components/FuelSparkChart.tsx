import { useEffect, useRef } from "react";
import * as d3 from "d3";

import type { HistoricalRetailPoint } from "../lib/snapshot";

interface Props {
  data: HistoricalRetailPoint[];
  color: string;
  weeks?: number;      // default 12
  minHeight?: number;  // fallback if wrapper has no measurable height
}

interface Parsed {
  date: Date;
  price: number; // NZ cents/L
}

// Tight margins — this is a row-sized chart, not a hero
const MARGIN = { top: 14, right: 56, bottom: 22, left: 12 };

function parse(points: HistoricalRetailPoint[]): Parsed[] {
  return points
    .map((p) => ({ date: new Date(p.week_ending), price: p.price }))
    .filter((p) => !Number.isNaN(p.date.getTime()));
}

export function FuelSparkChart({
  data,
  color,
  weeks = 12,
  minHeight = 150,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svgEl = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!wrap || !svgEl || !tooltip) return;

    const sliced = parse(data).slice(-weeks);
    if (sliced.length === 0) return;

    const render = () => {
      const width = wrap.clientWidth;
      const height = Math.max(wrap.clientHeight, minHeight);
      if (width === 0) return;

      const x = d3
        .scaleTime()
        .domain(d3.extent(sliced, (d) => d.date) as [Date, Date])
        .range([MARGIN.left, width - MARGIN.right]);

      const yMin = d3.min(sliced, (d) => d.price)! * 0.985;
      const yMax = d3.max(sliced, (d) => d.price)! * 1.015;
      const y = d3
        .scaleLinear()
        .domain([yMin, yMax])
        .range([height - MARGIN.bottom, MARGIN.top]);

      const line = d3
        .line<Parsed>()
        .x((d) => x(d.date))
        .y((d) => y(d.price))
        .curve(d3.curveMonotoneX);

      const area = d3
        .area<Parsed>()
        .x((d) => x(d.date))
        .y0(height - MARGIN.bottom)
        .y1((d) => y(d.price))
        .curve(d3.curveMonotoneX);

      const svg = d3.select(svgEl).attr("viewBox", `0 0 ${width} ${height}`);
      svg.selectAll("*").remove();

      // --- 3 horizontal gridlines ----------------------------------------
      const yTicks = y.ticks(3);
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

      // Right-side y labels — $X.XX per litre, mono tabular
      svg
        .append("g")
        .selectAll("text")
        .data(yTicks)
        .enter()
        .append("text")
        .attr("x", width - MARGIN.right + 8)
        .attr("y", (d) => y(d))
        .attr("dy", "0.32em")
        .attr("fill", "var(--ink-40)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 9)
        .attr("font-variant-numeric", "tabular-nums")
        .text((d) => `$${(d / 100).toFixed(2)}`);

      // --- X-axis: fortnightly tick marks + labels ------------------------
      // 12 weeks of data → show ~6 labels (every other week) so readers
      // can see "where on the timeline am I hovering" without the labels
      // cramming into each other.
      const fmtShort = d3.timeFormat("%d %b");
      const xGroup = svg.append("g");
      xGroup
        .append("line")
        .attr("x1", MARGIN.left)
        .attr("x2", width - MARGIN.right)
        .attr("y1", height - MARGIN.bottom)
        .attr("y2", height - MARGIN.bottom)
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-width", 1);

      // Pick approximately every-other-week from the actual data points,
      // always including the first and last so the window edges are clear.
      const tickCount = Math.min(6, sliced.length);
      const tickStep = (sliced.length - 1) / (tickCount - 1);
      const xTickIdx = Array.from({ length: tickCount }, (_, i) =>
        Math.round(i * tickStep),
      );
      const xTicks = xTickIdx.map((i) => sliced[i]);
      const lastIdx = xTicks.length - 1;

      // Small tick marks at each label position
      xGroup
        .selectAll("line.xtick")
        .data(xTicks)
        .enter()
        .append("line")
        .attr("class", "xtick")
        .attr("x1", (d) => x(d.date))
        .attr("x2", (d) => x(d.date))
        .attr("y1", height - MARGIN.bottom)
        .attr("y2", height - MARGIN.bottom + 4)
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-width", 1);

      // Labels — anchor the first label to the left edge, last to the right,
      // middle labels centered. Prevents clipping at the chart edges.
      xGroup
        .selectAll("text.xlabel")
        .data(xTicks)
        .enter()
        .append("text")
        .attr("class", "xlabel")
        .attr("x", (d) => x(d.date))
        .attr("y", height - 4)
        .attr("text-anchor", (_d, i) =>
          i === 0 ? "start" : i === lastIdx ? "end" : "middle",
        )
        .attr("fill", "var(--ink-40)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 9)
        .attr("letter-spacing", "0.06em")
        .text((d) => fmtShort(d.date).toLowerCase());

      // --- Area fill (behind the line) -----------------------------------
      // Adds visual weight without turning the chart into a block. 15%
      // alpha keeps the line itself dominant; the fill reads as a wash.
      svg
        .append("path")
        .datum(sliced)
        .attr("fill", color)
        .attr("fill-opacity", 0)
        .attr("stroke", "none")
        .attr("d", area)
        .transition()
        .delay(400)
        .duration(900)
        .ease(d3.easeCubicOut)
        .attr("fill-opacity", 0.15);

      // --- The line + data dots ------------------------------------------
      const path = svg
        .append("path")
        .datum(sliced)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2.4)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", line);

      const totalLength = (path.node() as SVGPathElement).getTotalLength();
      path
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(900)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);

      svg
        .append("g")
        .selectAll("circle.point")
        .data(sliced)
        .enter()
        .append("circle")
        .attr("class", "point")
        .attr("cx", (d) => x(d.date))
        .attr("cy", (d) => y(d.price))
        .attr("r", 2)
        .attr("fill", color)
        .attr("opacity", 0)
        .transition()
        .delay(800)
        .duration(300)
        .attr("opacity", 1);

      // --- Hover crosshair + tooltip -------------------------------------
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

      const focusDot = focus
        .append("circle")
        .attr("r", 4)
        .attr("fill", "var(--surface-0)")
        .attr("stroke", color)
        .attr("stroke-width", 2);

      const bisect = d3.bisector<Parsed, Date>((d) => d.date).left;
      const fmtTooltip = d3.timeFormat("%d %b %Y");
      const nearest = (date: Date): Parsed => {
        const i = bisect(sliced, date);
        const a = sliced[Math.max(0, i - 1)];
        const b = sliced[Math.min(sliced.length - 1, i)];
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
        const point = nearest(date);
        const ax = x(point.date);

        focus.select<SVGLineElement>(".crosshair-v").attr("x1", ax).attr("x2", ax);
        focusDot.attr("cx", ax).attr("cy", y(point.price));

        // Build tooltip contents via safe DOM APIs
        tooltip.textContent = "";
        const dateEl = document.createElement("div");
        dateEl.className = "tt-date";
        dateEl.textContent = `week ending ${fmtTooltip(point.date)}`;
        tooltip.append(dateEl);
        const priceEl = document.createElement("div");
        priceEl.className = "tt-val mono";
        priceEl.style.color = "var(--ink-100)";
        priceEl.textContent = `$${(point.price / 100).toFixed(3)}/L`;
        tooltip.append(priceEl);

        const svgRect = svgEl.getBoundingClientRect();
        const scaleX = svgRect.width / width;
        const wrapRect = wrap.getBoundingClientRect();
        const pixelX = ax * scaleX + (svgRect.left - wrapRect.left);
        const pixelY =
          y(point.price) * scaleX + (svgRect.top - wrapRect.top);
        const ttW = tooltip.offsetWidth || 160;
        const ttH = tooltip.offsetHeight || 60;
        let left = pixelX + 12;
        if (left + ttW > wrap.clientWidth - 8) left = pixelX - ttW - 12;
        const top = Math.max(
          8,
          Math.min(pixelY - ttH / 2, height - ttH - 8),
        );
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      });
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [data, color, weeks, minHeight]);

  return (
    <div className="fuel-spark" ref={wrapRef}>
      <svg
        ref={svgRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      <div ref={tooltipRef} className="crude-tooltip fuel-spark-tooltip" />
    </div>
  );
}
