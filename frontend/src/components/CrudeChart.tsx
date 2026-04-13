import { useEffect, useRef } from "react";
import * as d3 from "d3";

import type { Crude, CrudePoint, FX } from "../lib/snapshot";

interface Props {
  crude: Crude;
  fx: FX;
  height?: number;
}

interface Parsed {
  date: Date;
  usd: number;
}

const MARGIN = { top: 28, right: 72, bottom: 44, left: 12 };

function parse(points: CrudePoint[]): Parsed[] {
  return points
    .map((p) => ({ date: new Date(p.date), usd: p.usd }))
    .filter((p) => !Number.isNaN(p.date.getTime()));
}

function makeTooltipRow(
  tooltip: HTMLDivElement,
  color: string,
  label: string,
  usd: number,
  nzd: number,
) {
  const row = document.createElement("div");
  row.className = "tt-row";
  const swatch = document.createElement("span");
  swatch.className = "tt-swatch";
  swatch.style.background = color;
  const lab = document.createElement("span");
  lab.className = "tt-label";
  lab.textContent = label;
  const val = document.createElement("span");
  val.className = "tt-val mono";
  val.textContent = `$${usd.toFixed(2)}`;
  const alt = document.createElement("span");
  alt.className = "tt-alt mono";
  alt.textContent = `NZ$${nzd.toFixed(2)}`;
  row.append(swatch, lab, val, alt);
  tooltip.append(row);
}

export function CrudeChart({ crude, fx, height = 420 }: Props) {
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

      const brent = parse(crude.brent.series);
      const wti = parse(crude.wti.series);
      if (brent.length === 0 || wti.length === 0) return;

      const all = [...brent, ...wti];
      const xDomain = d3.extent(all, (d) => d.date) as [Date, Date];
      const x = d3
        .scaleTime()
        .domain(xDomain)
        .range([MARGIN.left, width - MARGIN.right]);

      const yMin = d3.min(all, (d) => d.usd)! * 0.97;
      const yMax = d3.max(all, (d) => d.usd)! * 1.03;
      const y = d3
        .scaleLinear()
        .domain([yMin, yMax])
        .range([height - MARGIN.bottom, MARGIN.top]);

      const line = d3
        .line<Parsed>()
        .x((d) => x(d.date))
        .y((d) => y(d.usd))
        .curve(d3.curveMonotoneX);

      const svg = d3.select(svgEl).attr("viewBox", `0 0 ${width} ${height}`);
      svg.selectAll("*").remove();

      // --- Horizontal gridlines + y labels --------------------------------
      const yTicks = y.ticks(5);
      svg
        .append("g")
        .attr("class", "grid")
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
        .text((d) => `$${d.toFixed(0)}`);

      // --- Monthly x-axis --------------------------------------------------
      const maxTicks = Math.max(
        4,
        Math.floor((width - MARGIN.left - MARGIN.right) / 110),
      );
      const monthTicks = x.ticks(d3.timeMonth.every(1) ?? d3.timeMonth);
      const step = Math.max(1, Math.ceil(monthTicks.length / maxTicks));
      const xTicks = monthTicks.filter((_, i) => i % step === 0);

      const xAxis = svg.append("g").attr("class", "x-axis");
      xAxis
        .append("line")
        .attr("x1", MARGIN.left)
        .attr("x2", width - MARGIN.right)
        .attr("y1", height - MARGIN.bottom)
        .attr("y2", height - MARGIN.bottom)
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-width", 1);

      xAxis
        .selectAll("line.tick")
        .data(xTicks)
        .enter()
        .append("line")
        .attr("class", "tick")
        .attr("x1", (d) => x(d))
        .attr("x2", (d) => x(d))
        .attr("y1", height - MARGIN.bottom)
        .attr("y2", height - MARGIN.bottom + 5)
        .attr("stroke", "var(--surface-line)")
        .attr("stroke-width", 1);

      const fmtMonth = d3.timeFormat("%b");
      const fmtYear = d3.timeFormat("%Y");

      xAxis
        .selectAll("text.label")
        .data(xTicks)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", (d) => x(d))
        .attr("y", height - MARGIN.bottom + 20)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--ink-40)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 10)
        .attr("letter-spacing", "0.06em")
        .text((d) => fmtMonth(d).toLowerCase());

      if (xTicks.length > 0) {
        xAxis
          .append("text")
          .attr("x", x(xTicks[0]))
          .attr("y", height - MARGIN.bottom + 34)
          .attr("text-anchor", "middle")
          .attr("fill", "var(--ink-40)")
          .attr("font-family", "var(--font-mono)")
          .attr("font-size", 9)
          .attr("opacity", 0.6)
          .text(fmtYear(xTicks[0]));
        xAxis
          .append("text")
          .attr("x", x(xTicks[xTicks.length - 1]))
          .attr("y", height - MARGIN.bottom + 34)
          .attr("text-anchor", "middle")
          .attr("fill", "var(--ink-40)")
          .attr("font-family", "var(--font-mono)")
          .attr("font-size", 9)
          .attr("opacity", 0.6)
          .text(fmtYear(xTicks[xTicks.length - 1]));
      }

      // --- Lines with draw-in animation -----------------------------------
      interface Series {
        key: "brent" | "wti";
        data: Parsed[];
        color: string;
        label: string;
      }
      const series: Series[] = [
        { key: "wti", data: wti, color: "var(--wti)", label: "WTI" },
        { key: "brent", data: brent, color: "var(--brent)", label: "BRENT" },
      ];

      series.forEach(({ key, data, color, label }) => {
        const path = svg
          .append("path")
          .datum(data)
          .attr("class", `line line-${key}`)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("stroke-linejoin", "round")
          .attr("stroke-linecap", "round")
          .attr("d", line);

        const totalLength = (path.node() as SVGPathElement).getTotalLength();
        path
          .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
          .attr("stroke-dashoffset", totalLength)
          .transition()
          .duration(1200)
          .ease(d3.easeCubicOut)
          .attr("stroke-dashoffset", 0);

        const last = data[data.length - 1];
        svg
          .append("text")
          .attr("x", x(last.date) + 6)
          .attr("y", y(last.usd))
          .attr("dy", "0.32em")
          .attr("fill", color)
          .attr("font-family", "var(--font-mono)")
          .attr("font-size", 10)
          .attr("letter-spacing", "0.08em")
          .attr("opacity", 0)
          .text(label)
          .transition()
          .delay(1100)
          .duration(400)
          .attr("opacity", 1);
      });

      // --- Interactive overlay: crosshair + focus dots + tooltip ----------
      const focus = svg.append("g").attr("class", "focus").style("display", "none");

      focus
        .append("line")
        .attr("class", "crosshair-v")
        .attr("y1", MARGIN.top)
        .attr("y2", height - MARGIN.bottom)
        .attr("stroke", "var(--amber-500)")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2 3");

      const focusDotWti = focus
        .append("circle")
        .attr("r", 4.5)
        .attr("fill", "var(--surface-0)")
        .attr("stroke", "var(--wti)")
        .attr("stroke-width", 2);

      const focusDotBrent = focus
        .append("circle")
        .attr("r", 4.5)
        .attr("fill", "var(--surface-0)")
        .attr("stroke", "var(--brent)")
        .attr("stroke-width", 2);

      // No on-axis hover date label — would collide with permanent axis
      // ticks. Tooltip header already carries the date prominently.

      const bisect = d3.bisector<Parsed, Date>((d) => d.date).left;
      const fmtTooltipDate = d3.timeFormat("%d %b %Y");

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
        .attr("class", "hit")
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
        const brentP = nearest(brent, date);
        const wtiP = nearest(wti, date);
        const anchor = brentP;
        const ax = x(anchor.date);

        focus.select<SVGLineElement>(".crosshair-v").attr("x1", ax).attr("x2", ax);
        focusDotBrent.attr("cx", x(brentP.date)).attr("cy", y(brentP.usd));
        focusDotWti.attr("cx", x(wtiP.date)).attr("cy", y(wtiP.usd));

        // Build tooltip via safe DOM APIs (no innerHTML)
        tooltip.textContent = "";
        const date_el = document.createElement("div");
        date_el.className = "tt-date";
        date_el.textContent = fmtTooltipDate(anchor.date);
        tooltip.append(date_el);
        makeTooltipRow(
          tooltip,
          "var(--brent)",
          "brent",
          brentP.usd,
          brentP.usd * fx.nzd_per_usd,
        );
        makeTooltipRow(
          tooltip,
          "var(--wti)",
          "wti",
          wtiP.usd,
          wtiP.usd * fx.nzd_per_usd,
        );

        // Position tooltip (clamped to wrap bounds)
        const svgRect = svgEl.getBoundingClientRect();
        const scaleX = svgRect.width / width;
        const wrapRect = wrap.getBoundingClientRect();
        const pixelX = ax * scaleX + (svgRect.left - wrapRect.left);
        const pixelY = y(brentP.usd) * scaleX + (svgRect.top - wrapRect.top);
        const ttW = tooltip.offsetWidth || 200;
        const ttH = tooltip.offsetHeight || 90;
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
  }, [crude, fx, height]);

  return (
    <div className="crudechart" ref={wrapRef}>
      <div className="chart-legend chart-legend-center">
        <span className="legend-item">
          <span className="legend-line" style={{ background: "var(--brent)" }} />
          brent
        </span>
        <span className="legend-item">
          <span className="legend-line" style={{ background: "var(--wti)" }} />
          wti
        </span>
      </div>
      <svg ref={svgRef} style={{ display: "block", width: "100%", height }} />
      <div ref={tooltipRef} className="crude-tooltip" />
    </div>
  );
}
