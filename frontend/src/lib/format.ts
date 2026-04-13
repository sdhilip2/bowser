const STALE_HOURS = 36;

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** NZ cents/L → $X.XXX/L string */
export function formatNzPerL(cents: number): string {
  return `$${(cents / 100).toFixed(3)}`;
}

/** Bare cents number with 1-decimal precision, used inside waterfall labels. */
export function formatCents(cents: number): string {
  return `${cents.toFixed(1)}c`;
}

export function formatPct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export interface RelativeTime {
  label: string;
  hoursAgo: number;
  stale: boolean;
}

export function relativeTime(iso: string, now: Date = new Date()): RelativeTime {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return { label: "unknown", hoursAgo: Infinity, stale: true };
  }
  const diffMs = now.getTime() - then.getTime();
  const mins = Math.max(0, Math.round(diffMs / 60_000));
  const hours = diffMs / 3_600_000;
  let label: string;
  if (mins < 1) label = "just now";
  else if (mins < 60) label = `${mins}m ago`;
  else if (hours < 24) label = `${Math.round(hours)}h ago`;
  else {
    const days = Math.round(hours / 24);
    label = `${days}d ago`;
  }
  return { label, hoursAgo: hours, stale: hours > STALE_HOURS };
}
