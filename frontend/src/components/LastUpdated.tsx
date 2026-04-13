import { relativeTime } from "../lib/format";

interface Props {
  generatedAt: string;
}

export function LastUpdated({ generatedAt }: Props) {
  const rel = relativeTime(generatedAt);
  return (
    <span className={`last-updated caption ${rel.stale ? "stale" : ""}`}>
      last updated {rel.label}
    </span>
  );
}
