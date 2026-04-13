import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";

import type { Crude, FX } from "../lib/snapshot";
import { formatPct, formatDateShort } from "../lib/format";

interface Props {
  crude: Crude;
  fx: FX;
  dieselDollars: number;  // NZ diesel price in dollars/L (pre-converted)
}

interface TickerProps {
  value: number;
  format: (n: number) => string;
  duration?: number;
  delay?: number;
}

function Ticker({ value, format, duration = 1.5, delay = 0 }: TickerProps) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => format(v));

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [value, duration, delay, mv]);

  return <motion.span className="mono">{rounded}</motion.span>;
}

export function Hero({ crude, fx, dieselDollars }: Props) {
  const brent = crude.brent;
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-head">
          <motion.p
            className="caption"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            the global fuel story · told from new zealand
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            Brent crude at{" "}
            <span className="hero-accent mono">
              <Ticker
                value={brent.latest}
                format={(v) => `US$${v.toFixed(2)}`}
                delay={0.3}
              />
              <span className="hero-unit">/bbl</span>
            </span>
            .
            <br />
            NZ diesel at{" "}
            <span className="hero-accent mono">
              <Ticker
                value={dieselDollars}
                format={(v) => `NZ$${v.toFixed(2)}`}
                delay={0.45}
              />
              <span className="hero-unit">/L</span>
            </span>
            .
          </motion.h1>
          <motion.p
            className="hero-deck"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
          >
            A live read on Brent and WTI spot prices, New Zealand pump
            medians, and the MBIE weekly waterfall — what actually sits
            between a barrel of crude and the number on the bowser.
          </motion.p>
        </div>
        <motion.aside
          className="hero-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="caption">
            brent crude · usd per barrel · as at {formatDateShort(brent.latest_date)}
          </p>
          <p className="hero-card-value mono">
            <Ticker
              value={brent.latest}
              format={(v) => `US$${v.toFixed(2)}`}
              delay={0.6}
            />
          </p>
          <div className="hero-card-deltas">
            <div>
              <p className="caption">prev close</p>
              <p className={`mono ${brent.delta_1d_pct >= 0 ? "up" : "down"}`}>
                {formatPct(brent.delta_1d_pct)}
              </p>
            </div>
            <div>
              <p className="caption">30 days</p>
              <p className={`mono ${brent.delta_30d_pct >= 0 ? "up" : "down"}`}>
                {formatPct(brent.delta_30d_pct)}
              </p>
            </div>
            <div>
              <p className="caption">nzd/usd</p>
              <p className="mono">{fx.nzd_per_usd.toFixed(3)}</p>
            </div>
          </div>
          <p className="caption hero-card-footnote">
            brent front-month futures via{" "}
            <a
              href="https://finance.yahoo.com/quote/BZ=F/"
              target="_blank"
              rel="noreferrer"
            >
              yahoo finance
            </a>
            {" · close-of-day · refreshed every morning at 07:00 nzst"}
          </p>
        </motion.aside>
      </div>
    </section>
  );
}
