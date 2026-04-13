import { motion } from "framer-motion";

interface Props {
  onBack: () => void;
}

export function AboutPage({ onBack }: Props) {
  return (
    <div className="about-page">
      <header className="about-topbar container">
        <button
          className="wordmark wordmark-button"
          onClick={onBack}
          type="button"
        >
          bowser
        </button>
        <button
          className="about-back caption"
          onClick={onBack}
          type="button"
        >
          ← back to dashboard
        </button>
      </header>

      <main className="about-main container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="caption about-eyebrow">about</p>
          <h1>
            A public dashboard connecting global crude oil markets to New
            Zealand pump prices.
          </h1>
          <p className="about-deck">
            Bowser turns regulatory and market data into an editorial story —
            how a barrel of oil becomes the number on your local pump.
          </p>
        </motion.div>

        <motion.section
          className="about-section"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
        >
          <h2>What it shows</h2>
          <p>Six sections, one scroll-through story:</p>
          <ul className="about-list">
            <li>
              <strong>Global crude</strong> — daily Brent and WTI front-month
              futures from Yahoo Finance, 12 months of history with an
              interactive crosshair
            </li>
            <li>
              <strong>NZ pump prices</strong> — today's national averages from
              CardLink PriceWatch with 12-week MBIE trend charts per fuel
            </li>
            <li>
              <strong>10-year history</strong> — weekly MBIE retail prices back
              to 2016, filterable by year with a zoom-to-month view
            </li>
            <li>
              <strong>Waterfall</strong> — MBIE's breakdown of how every cent
              at the pump splits into pre-tax cost, ETS, excise, and GST
            </li>
            <li>
              <strong>Fuel supply</strong> — NZ's days-of-cover across petrol,
              diesel, and jet fuel, by storage stage (in-country, within EEZ,
              outside EEZ)
            </li>
            <li>
              <strong>Live news</strong> — oil market and geopolitical
              headlines that drive prices, refreshed hourly from Google News
            </li>
          </ul>
        </motion.section>

        <motion.section
          className="about-section"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
        >
          <h2>Why it exists</h2>
          <p>
            Fuel pricing in New Zealand is one of the most politically charged
            numbers in the country, but the data that explains it is scattered
            across seven sources in seven different formats. Bowser unifies
            them into a single editorial page that tells the connection from{" "}
            <em>news</em> to <em>crude</em> to <em>waterfall</em> to{" "}
            <em>pump</em> to <em>trend</em>.
          </p>
          <p>
            It's a personal portfolio project built to demystify NZ fuel
            pricing — not a trading tool, not a forecast, not financial advice.
          </p>
        </motion.section>

        <motion.section
          className="about-section"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
        >
          <h2>How it's built</h2>
          <p>
            A Python collector fetches all data once per day at 07:00 NZST —
            news refreshes hourly — validates with Pydantic schemas, and
            writes a single ~175 KB <code>snapshot.json</code> file. A React +
            Vite + D3 frontend reads that file and renders every chart as
            hand-coded D3 v7 SVG.
          </p>
          <p className="about-stack">
            Stack: Python 3.13 · uv · httpx · feedparser · pandas · pydantic ·
            APScheduler · React 18 · TypeScript · Vite · D3 v7 · Framer Motion
            · Fontsource (Fraunces, Inter Tight, JetBrains Mono). No database,
            no API server, no login — just a static snapshot file and a client
            that renders it.
          </p>
        </motion.section>

        <motion.section
          className="about-section"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
        >
          <h2>Data sources</h2>
          <p>All free and public:</p>
          <ul className="about-list">
            <li>
              <strong>Yahoo Finance</strong> — Brent (BZ=F) and WTI (CL=F)
              front-month futures, daily close
            </li>
            <li>
              <strong>CardLink PriceWatch</strong> — NZ retail fuel prices
              from fuel-card transactions across 19 regions
            </li>
            <li>
              <strong>MBIE Weekly Fuel Price Monitoring</strong> — official
              NZ regulatory retail data, CC BY 4.0 NZ licensed, covering
              2004-present
            </li>
            <li>
              <strong>MBIE Fuel Stocks</strong> — days-of-cover by fuel type,
              updated Monday and Wednesday afternoons
            </li>
            <li>
              <strong>Google News RSS</strong> — NZ and global oil markets +
              geopolitics news, aggregated across 8 queries, deduped and
              sorted by publication date
            </li>
            <li>
              <strong>ExchangeRate-API</strong> — daily NZD/USD rate for
              currency conversion on the crude chart
            </li>
          </ul>
        </motion.section>

        <motion.section
          className="about-section"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6 }}
        >
          <h2>Caveats</h2>
          <p>
            MBIE publishes the waterfall's importer cost vs margin split 2-4
            months after each week ends. The current waterfall shows the
            freshest 4-component breakdown (Provisional) and includes the last
            finalised cost/margin split as supporting context in the footnote.
          </p>
          <p>
            NZ retail prices vary significantly by region and brand. National
            averages are indicative only — your local pump may differ by
            20-40¢.
          </p>
          <p>
            Brent and WTI prices shown are <em>front-month futures</em>, not
            spot. They track within a fraction of a percent of spot on normal
            days but can diverge in acute market events.
          </p>
        </motion.section>

        <motion.section
          className="about-section"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.6 }}
        >
          <h2>Contact</h2>
          <p>
            Built by <strong>Dhilip Subramanian</strong>.
          </p>
          <p className="about-links">
            <a href="https://x.com/sdhilip" target="_blank" rel="noreferrer">
              X / @sdhilip
            </a>
            {" · "}
            <a
              href="https://www.linkedin.com/in/dhilip-subramanian-36021918b/?skipRedirect=true"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
          </p>
        </motion.section>

        <footer className="about-footer">
          <hr className="hairline" />
          <button
            className="about-back-bottom caption"
            onClick={onBack}
            type="button"
          >
            ← back to dashboard
          </button>
        </footer>
      </main>
    </div>
  );
}
