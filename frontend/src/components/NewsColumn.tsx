import type { ReactNode } from "react";

import type { NewsItem } from "../lib/snapshot";
import { relativeTime } from "../lib/format";

interface Props {
  title: string;
  eyebrow: ReactNode;
  items: NewsItem[];
}

export function NewsColumn({ title, eyebrow, items }: Props) {
  return (
    <section className="newscol">
      <header className="section-header">
        <p className="caption">{eyebrow}</p>
        <h3>{title}</h3>
      </header>
      <ol className="news-list">
        {items.map((item, i) => {
          const rel = relativeTime(item.published);
          return (
            <li key={i} className="news-item">
              <a href={item.url} target="_blank" rel="noreferrer">
                <span className="news-num caption">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="news-body">
                  <span className="news-title">{stripSourceSuffix(item.title, item.source)}</span>
                  <span className="caption news-meta">
                    {item.source || "source"} · {rel.label}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function stripSourceSuffix(title: string, source: string): string {
  if (!source) return title;
  const suffix = ` - ${source}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}
