import { useMemo } from "react";
import * as d3 from "d3";

interface Props {
  values: number[];    // any numeric series, we normalise internally
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;       // optional area fill under the line
  strokeWidth?: number;
}

/** Axis-less single-line sparkline. Designed for pump-card-sized inserts.
 * No tooltip, no ticks — purely a shape. Use the surrounding context to
 * label units / window. */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  stroke = "var(--ink-40)",
  fill,
  strokeWidth = 1.5,
}: Props) {
  const { path, area, dotX, dotY } = useMemo(() => {
    if (values.length === 0) {
      return { path: "", area: "", dotX: 0, dotY: 0 };
    }
    const xs = values.map((_, i) => i);
    const x = d3.scaleLinear().domain([0, Math.max(1, values.length - 1)]).range([2, width - 2]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.15 || 1;
    const y = d3.scaleLinear().domain([min - pad, max + pad]).range([height - 2, 2]);

    const line = d3
      .line<number>()
      .x((i) => x(xs[i]))
      .y((i) => y(values[i]))
      .curve(d3.curveMonotoneX);

    const areaGen = d3
      .area<number>()
      .x((i) => x(xs[i]))
      .y0(height - 2)
      .y1((i) => y(values[i]))
      .curve(d3.curveMonotoneX);

    const indices = xs.map((_, i) => i);
    return {
      path: line(indices) ?? "",
      area: areaGen(indices) ?? "",
      dotX: x(xs.length - 1),
      dotY: y(values[values.length - 1]),
    };
  }, [values, width, height]);

  if (values.length === 0) {
    return null;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      {fill && <path d={area} fill={fill} stroke="none" />}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={dotX}
        cy={dotY}
        r={2}
        fill={stroke}
      />
    </svg>
  );
}
