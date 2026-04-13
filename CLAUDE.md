# CLAUDE.md — Bowser v1 (as built)

> **This file describes what Bowser v1 *is*, not what it was originally scoped to be.**
> The original spec is preserved in git history (`ab2b2df`). This revision
> reflects the actual shipped state after ~two weeks of iteration: different
> data sources, a cream light theme, two extra data layers, and a full
> About page that weren't in the original plan.
> Stick to the behavior this file describes unless the user asks for a change.

---

## 0. How You Should Work (Claude Code directives)

**Use your skills.** Before writing any non-trivial code, check `/mnt/skills/` (or wherever your skills are mounted) and read the relevant `SKILL.md` files. In particular:

- **`frontend-design`** — load this BEFORE writing any React component, CSS, or design token. The aesthetic direction in §6 is binding; re-read it before each frontend file.
- **Any Python / data skills** — load before writing collector code.

If a skill exists for something you're about to do, **read it first**. Do not work from memory.

**Other working rules:**
- **Commit to git before risky changes.** The repo is a real git repo (`git init` was run during the scroll-vs-tabs experiment). For anything significant — design changes, architecture swaps, new data sources — commit the current state first so revert is one command.
- Run code as you write it. Smoke-test each collector module the moment it exists.
- No `TODO`, no `console.log`, no commented-out code in committed files.
- If you hit a real ambiguity, ask. If it's a minor decision, make it and note it.
- **Stick to what's in this file.** Major additions (new data sources, layout restructures, extra pages) should be discussed with the user first before building.

---

## 1. Identity

- **Name**: Bowser
- **Why the name**: "Bowser" is Aus/NZ slang for a petrol pump. Locally rooted, globally curious.
- **Tagline**: "The global fuel story, told from New Zealand"
- **Author**: Dhilip Subramanian ([@sdhilip](https://x.com/sdhilip) · [LinkedIn](https://www.linkedin.com/in/dhilip-subramanian-36021918b/?skipRedirect=true))
- **Wordmark**: lowercase **bowser** in Fraunces serif.
- **Purpose**: A public dashboard that connects global crude oil markets to New Zealand pump prices, built on free public data. Portfolio piece that doubles as a Commerce Commission relevance showcase — it visualises MBIE's own fuel monitoring data the regulator uses.
- **It is NOT**: a clone of fuelwatch.nz, a tanker tracker, a trading tool, or a forecast.

---

## 2. v1 Scope (what actually shipped)

One page, one scroll, one editorial narrative. Six sections top-to-bottom plus a separate About page.

### Layer A — Global Crude (the "why")
- Brent + WTI **front-month futures** (not spot) from **Yahoo Finance's chart API** (`BZ=F`, `CL=F`)
- Last 12 months of daily closes (~251 trading days per series)
- D3 line chart with draw-in animation, crosshair + focus dots + tooltip on hover, centered legend, monthly x-axis ticks
- Latest price, prev-close delta, 30-day delta, NZD/USD rate on the hero card

### Layer B — NZ Retail (the "what")
Four sub-sections in one scroll block:

1. **Pump price cards** — 3 cards (regular 91, premium 95, diesel) with:
   - Current price from **CardLink PriceWatch** (fuel-card transaction averages)
   - 4-week delta computed from MBIE weekly historical
   - Brand-range min / max and observation count
   - Petrol / diesel type tag
2. **12-week per-fuel sparkcharts** — one small area chart per fuel, 12 weekly MBIE points each, card-aligned side-by-side
3. **Two-column header** — left caption "today · CardLink" vs right caption "last 12 weeks · MBIE" so the two time horizons are explicit

### Layer C — 10-Year Historical Retail
- 10 years of MBIE weekly `Adjusted retail price` for the 3 fuels
- Full D3 line chart with centered legend, monthly/yearly axis ticks
- **Year filter dropdown** (all / 2026 / 2025 / ... / 2016) — switching a specific year triggers month-scale x-axis ticks and re-renders the chart
- Crosshair + focus dots + tooltip on hover

### Layer D — Waterfall (the "where your dollar goes")
- Latest MBIE Provisional week, 4 components: `pre_tax` + `ets` + `excise` + `gst` → `adjusted_retail`
- Edge-to-edge D3 chart with centered legend
- Historical cost/margin split footnote (from the latest MBIE Final week) for context
- This is the editorial centerpiece — "where your pump dollar goes"

### Layer E — Fuel Supply
- **MBIE Fuel Stocks** scraped from their news page (published Mon + Wed)
- 3 stat cards (petrol / diesel / jet) with icons and days-of-cover
- Interactive D3 horizontal stacked bar chart with:
  - 3 stages per fuel: `in-country`, `within EEZ (2 days away)`, `outside EEZ (3 weeks away)`
  - Three distinct colors (near-black / coffee / warm gold)
  - Inline day labels on each segment (when segment is wide enough)
  - Centered legend with descriptive labels + ship counts
  - Hover tooltip showing per-segment values + percent of fuel total
- Breakdown table below with category hints
- Intro paragraph explaining the EEZ concept

### Layer F — News (the "context")
- Two columns: NZ fuel news + global oil/geopolitics news
- **6 Google News RSS queries merged per column** (NZ fuel price, NZ petrol diesel, global oil crude, Brent/WTI, Iran sanctions, US policy, OPEC, Russia sanctions)
- Top 8 per column, sorted latest-first by published date, URL-deduped
- Source, time-ago, clickable title

### Separate About page (not in original spec — added)
- Hash-routed `#/about`
- Full editorial page explaining Bowser's purpose, data sources, caveats, contact
- Back button returns to the dashboard
- Links to X + LinkedIn

### Footer
- 2 columns: disclaimer + built by
- Disclaimer explicitly states non-affiliation with employer + "not financial advice"
- Built by "Dhilip Subramanian" on one line, "X · LinkedIn" on the second
- All source attributions are clickable links on every chart caption

### Explicitly OUT of v1 (do not build without asking)
- World Bank country comparison
- Flight cancellation panel
- AI risk assessment (Claude API)
- User accounts, alerts, email
- Map view
- Mobile app
- Live ticker wiggle (tried and removed — felt fake)
- Tabbed / multi-page dashboard (tried and removed — felt like PowerPoint)

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Scheduler (APScheduler locally; Cloud Scheduler in prod)   │
│  Daily full collector at 07:00 NZST                         │
│  Hourly news-only refresh                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Collector (Python 3.13)                                    │
│  Pulls Yahoo / CardLink / MBIE weekly / MBIE stocks /       │
│  Google News / ExchangeRate-API → writes snapshot.json      │
│  Also writes a dated copy to collector/archive/             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
              data/snapshot.json  (single file, ~175 KB)
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  React + Vite + D3 frontend (static)                        │
│  Reads snapshot.json on load, renders D3 visualisations     │
└─────────────────────────────────────────────────────────────┘
```

- **No database.** A single JSON snapshot is the entire backend state.
- **No API server in v1.** The frontend fetches `/data/snapshot.json` directly.
- **No auth, no users, no sessions.**
- **Daily archive** accumulates dated snapshots in `collector/archive/snapshot-YYYY-MM-DD.json` for future historical reads (not currently rendered, but the infrastructure is in place).
- Local dev: collector writes to `frontend/public/data/snapshot.json`, Vite serves it.
- Production (later): Cloud Run job writes to a GCS bucket, Cloudflare Pages serves the frontend.

---

## 4. Repo Structure

```
bowser/
├── CLAUDE.md                    ← this file
├── README.md
├── Makefile
├── .env.example                 ← no keys required; empty template
├── .gitignore                   ← excludes .env, node_modules, snapshot, archive, screenshots
│
├── collector/                   ← Python data pipeline
│   ├── pyproject.toml
│   ├── main.py                  ← entrypoint + refresh_news_only()
│   ├── scheduler.py             ← APScheduler: daily + hourly news
│   ├── sources/
│   │   ├── crude.py             ← Yahoo Finance (was eia.py)
│   │   ├── cardlink.py          ← CardLink PriceWatch (was gaspy.py)
│   │   ├── mbie.py              ← Weekly CSV → waterfall + 10yr history
│   │   ├── mbie_stocks.py       ← Fuel Stocks HTML scrape
│   │   ├── news.py              ← 6 Google News RSS queries merged
│   │   └── fx.py                ← NZD/USD daily
│   ├── schema.py                ← Pydantic models for snapshot.json
│   ├── archive/                 ← dated snapshot copies (gitignored)
│   └── tests/
│       └── test_sources.py      ← one smoke test per source
│
├── deploy/
│   ├── Dockerfile.collector     ← container for Cloud Run job (template)
│   └── cloudrun-job.yaml        ← Cloud Run + Scheduler config (template)
│
└── frontend/                    ← React + Vite + D3
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    ├── public/
    │   └── data/
    │       └── snapshot.json    ← written by collector
    └── src/
        ├── main.tsx
        ├── App.tsx              ← single scroll layout + hash routing to About
        ├── styles/
        │   ├── tokens.css       ← cream theme tokens (see §6)
        │   ├── global.css       ← typography, containers, hairlines
        │   └── layout.css       ← all section layouts + chart styles
        ├── components/
        │   ├── Hero.tsx                 ← asymmetric 7/5 grid + count-up tickers
        │   ├── CrudeChart.tsx           ← D3 Brent + WTI line
        │   ├── PumpPriceCards.tsx       ← 3 pump cards + 3 sparkcharts
        │   ├── FuelSparkChart.tsx       ← per-fuel 12-week chart with area fill
        │   ├── RetailTrendChart.tsx     ← 10-year chart with year filter
        │   ├── WaterfallChart.tsx       ← 4-component MBIE waterfall
        │   ├── FuelSupply.tsx           ← stat cards + D3 stacked bars + table
        │   ├── NewsColumn.tsx           ← single news column
        │   ├── Footer.tsx               ← disclaimer + built-by
        │   ├── Nav.tsx                  ← sticky nav with scroll-active highlight
        │   ├── LastUpdated.tsx          ← top-right timestamp with stale guard
        │   ├── AboutPage.tsx            ← full About page (hash route)
        │   └── Sparkline.tsx            ← generic minimal sparkline (reused)
        └── lib/
            ├── format.ts        ← number/date/relative-time formatters
            └── snapshot.ts      ← typed snapshot loader
```

---

## 5. Data Sources (all free, no API keys)

### 5.1 Yahoo Finance — Brent + WTI
- Base: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`
- Auth: none (undocumented but stable public API)
- Symbols: `BZ=F` (Brent front-month futures), `CL=F` (WTI front-month futures)
- Pull: `range=1y interval=1d` → ~251 trading days per series
- **Note**: these are *front-month futures*, not spot. They track spot within <1% on normal days but can diverge in acute market events. Original spec used EIA RBRTE/RWTC but that series diverged ~35% from live markets in April 2026; swapped to Yahoo for reader-facing credibility.

### 5.2 CardLink PriceWatch — NZ retail
- URL: `https://www.pricewatch.co.nz/`
- Auth: none
- Parse: HTML scrape of all 19 NZ regions × all brands × 5 fuels (91, 95/96, 98, Diesel, LPG)
- Aggregates to national min / avg / max per fuel + observation count
- Freshness flags extracted from bgcolor: today / yesterday / older
- **Why not Gaspy**: Gaspy's data is sold commercially via Datamine.com (see §5.2 of original spec). CardLink is a fuel-card processing company that publishes PriceWatch as a free public marketing tool for their card customers — very different legal posture, same data quality. Cross-validated: Gaspy and CardLink national averages typically agree within 1 cent.

### 5.3 MBIE Weekly Fuel Price Monitoring — waterfall + 10-year history
- URL: `https://www.mbie.govt.nz/assets/Data-Files/Energy/Weekly-fuel-price-monitoring/weekly-table.csv`
- Auth: none (Creative Commons Attribution 4.0 NZ)
- Format: long-format CSV, ~34k rows spanning 2004 to present
- Two parsers share a single download:
  - **Waterfall**: filters to latest *Provisional* week with all 4 non-finalised components (`Price excluding tax`, `ETS`, `Taxes`, `GST`, `Adjusted retail price`). Also extracts the latest *Final* week's `Importer cost` + `Importer margin` as `historical_split` context for the footnote.
  - **Historical retail**: weekly `Adjusted retail price` for Regular Petrol, Premium 95R, Diesel, last 10 years, deduped by week.
- **Why Provisional instead of Final**: Final weeks lag 2-4 months because MBIE firms up importer cost/margin on a delay. Provisional weeks give us a 4-component waterfall that refreshes weekly. The cost/margin split appears in the footnote from the last Final week as supporting context.

### 5.4 MBIE Fuel Stocks — days-of-cover
- URL: `https://www.mbie.govt.nz/about/news/fuel-stocks-update`
- Auth: none
- Format: HTML news article (no CSV/JSON feed exists)
- Parse: regex-based tolerant parser targeting stable semantic anchors (`In-country`, `On water within EEZ`, `On water outside EEZ`, `Total NZ stock*`). Extracts per-fuel (petrol/diesel/jet) breakdowns.
- Updated Mondays + Wednesdays afternoons by MBIE.
- **Fail-soft**: if the parser breaks, `fetch()` returns `None` and the Fuel Supply section is conditionally hidden from the frontend. Other sections unaffected.

### 5.5 Google News RSS (x6 queries per column)
- NZ queries: `"New Zealand fuel price"`, `"New Zealand petrol diesel"`
- Global queries: `"global oil price crude"`, `'"Brent" OR "WTI" crude'`, `"Iran oil sanctions"`, `"US oil policy OPEC"`, `"Middle East oil supply"`, `"Russia oil sanctions"`
- Parse with `feedparser`, merge across queries per column, dedupe by URL, sort by `published_parsed` DESC, take top 8 per column.
- One bad query never kills the feed — per-query try/except with continue.
- **Why the fanout**: geopolitics drives oil prices more than fundamentals in most news cycles. Single-query results got diluted; 6 narrow queries combined cover the full story.

### 5.6 ExchangeRate-API — NZD/USD
- URL: `https://open.er-api.com/v6/latest/USD`
- Auth: none
- Used for Brent USD → NZD conversion in the crude chart tooltip.

---

## 6. Design Direction — "Editorial Energy Terminal" (cream edition)

This is a **commitment**, not a starting point. **Read the `frontend-design` skill before touching any UI file.**

**Aesthetic concept**: Imagine the Financial Times' weekend energy supplement crossed with a cream-paper Bloomberg Terminal. Editorial confidence, data density where it matters, generous negative space. **Cream parchment base, warm coffee single accent, serif headlines, monospace numerics.** Quiet luxury, not flashy.

**Note**: original spec was a dark warm-black theme with amber accent. We flipped to cream + coffee during iteration after user preference. Everything else (typography, spacing, motion) is unchanged.

### 6.1 Design Tokens (`frontend/src/styles/tokens.css`)

```css
:root {
  /* Surfaces — warm parchment cream */
  --surface-0: #faf6f1;     /* page background */
  --surface-1: #f3ede4;     /* subtle warm panel */
  --surface-2: #ffffff;     /* elevated card */
  --surface-line: #e8ddd0;  /* hairline borders */

  /* Ink — warm brown-black, all three tiers WCAG AAA on cream */
  --ink-100: #3b2f2f;       /* primary text        ~11:1 contrast */
  --ink-70:  #4a3e32;       /* secondary           ~9:1  contrast */
  --ink-40:  #5a4e42;       /* tertiary / captions ~7:1  contrast */

  /* Single accent — coffee brown */
  --amber-500: #8b5e3c;     /* primary accent */
  --amber-300: #a0714d;     /* lighter variant */
  --amber-glow: #8b5e3c22;  /* subtle amber wash */

  /* Semantic — data viz only */
  --up:    #2d7d5a;   /* forest green (desaturated for cream bg) */
  --down:  #b83838;   /* brick red */
  --brent: #8b5e3c;   /* coffee — primary crude line */
  --wti:   #3b2f2f;   /* near-black — secondary crude line */

  /* Type scale */
  --font-display: "Fraunces Variable", Georgia, serif;
  --font-body:    "Inter Tight Variable", system-ui, sans-serif;
  --font-mono:    "JetBrains Mono Variable", ui-monospace, monospace;

  /* Spacing — 8pt grid with editorial generosity */
  --space-1: 4px;  --space-2: 8px;  --space-3: 16px;
  --space-4: 24px; --space-5: 40px; --space-6: 64px;
  --space-7: 96px; --space-8: 144px;

  /* Motion */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-quart: cubic-bezier(0.76, 0, 0.24, 1);
}
```

### 6.2 Typography Rules
- **Headlines**: Fraunces, weight 400, optical size 144, slight negative letter-spacing. Big — 64–96px on hero.
- **Body**: Inter Tight, weight 400, 16/26.
- **Numerics in data viz**: JetBrains Mono with `font-feature-settings: "tnum"` (tabular figures) so digits don't jitter.
- Never use Inter, Roboto, Arial, or system-ui for display.

### 6.3 Layout Principles
- Single column, max-width 1200px, generous side margins on desktop.
- The waterfall chart breaks the grid — edge-to-edge with a subtle radial gradient.
- Asymmetric hero: headline left-aligned takes 7 columns, latest crude price card takes 5 columns, vertically **center-aligned**.
- Hairline borders (1px `--surface-line`) instead of heavy boxes. Cards have no shadow (tooltips have a subtle soft shadow).

### 6.4 Motion Rules
- **One orchestrated page load**: hero fades up, charts draw in with stroke-dashoffset, cards stagger in with `framer-motion`.
- D3 line draw-in: animate `stroke-dashoffset` from path length to 0.
- D3 waterfall: bars grow from baseline with `ease-out-expo`, then running totals fade in.
- Number tickers on hero stats: count up from 0 to value over 1500ms on load. Static after. **No wiggle / "live ticker" effects** — tried and removed for honesty.
- **No micro-interactions on every element.** Save the motion budget for the hero load.

### 6.5 Chart Specifics
- All charts: **pure D3 v7**, no Recharts, no Chart.js, no Nivo.
- React owns the DOM container, D3 owns the SVG inside.
- Axes: thin 1px `--surface-line` lines, no tick marks, labels in `--ink-40` mono.
- **All legends centered** (top-center) — removed inline end-of-line labels to avoid collision with the legend.
- Waterfall running total above each bar in mono numerics, segments labeled below in NZD c/L.
- **All source names in every chart caption are clickable hyperlinks** to the source's own data page.

### 6.6 What this design must NEVER do
- No purple gradients
- No glassmorphism / frosted blur (the tooltip's subtle blur is the one exception)
- No emoji icons (SVG icons only — see Petrol/Diesel/Jet icons in FuelSupply)
- No rounded-2xl-on-everything
- No "AI assistant" chat bubble in the corner
- No pie charts (stacked bars and waterfalls are the allowed bar forms)
- No copy-paste shadcn aesthetic
- No "Powered by" badges
- No light/dark mode toggle (cream is the only theme)
- No tabbed / multi-page layouts (tried, reverted — kills the editorial story)
- No fake "live ticker" wiggle animations (tried, reverted — felt dishonest)

---

## 7. snapshot.json schema

Single file written by the collector, read by the frontend. Strict shape enforced by Pydantic.

```ts
{
  generated_at: string,           // ISO timestamp — drives footer "last updated"
  fx: { nzd_per_usd: number, as_of: string },

  crude: {
    brent: {
      latest: number,
      latest_date: string,         // ISO date of the most recent data point
      delta_1d_pct: number,        // change vs previous trading day
      delta_30d_pct: number,       // change vs 30 trading days ago
      series: [{ date: string, usd: number }]  // ~251 daily closes
    },
    wti: { ...same shape... }
  },

  nz_retail: {
    as_of: string,
    regular_91: { avg, min, max, count },  // dollars/L; count = brand × region observations
    premium_95: { avg, min, max, count },
    premium_98: { avg, min, max, count },
    diesel:     { avg, min, max, count },
    lpg:        { avg, min, max, count },
    observations_today: number,            // freshness counts from CardLink bgcolor
    observations_yesterday: number,
    observations_older: number
  } | null,                                // null if CardLink scraper fails

  mbie_waterfall: {
    week_ending: string,                    // ISO date of latest Provisional week
    fuel: "Regular Petrol" | "Premium Petrol 95R" | "Diesel",
    components: {
      pre_tax: number,                      // importer cost + margin combined
      ets: number,
      excise: number,
      gst: number
    },
    adjusted_retail: number,
    historical_split: {                     // latest Final week with full split
      week_ending: string,
      importer_cost: number,
      importer_margin: number
    } | null
  },

  historical_retail: {
    regular_91: [{ week_ending: string, price: number }],  // ~536 weekly points
    premium_95: [...],
    diesel:     [...]
  },

  fuel_stocks: {
    as_of: string,
    published: string,
    petrol_days: number,
    diesel_days: number,
    jet_days: number,
    petrol_breakdown: { in_country, eez_water, outside_eez },
    diesel_breakdown: { ...same... },
    jet_breakdown:    { ...same... },
    ships_in_eez: number,
    ships_outside_eez: number
  } | null,                                 // null if MBIE scraper fails

  news: {
    nz:     [{ title, source, published, url }],  // top 8, latest-first
    global: [...]                                  // top 8, latest-first
  }
}
```

The frontend imports a typed loader (`lib/snapshot.ts`) and is strict about shape. `nz_retail` and `fuel_stocks` are nullable so scraper failures hide their sections gracefully without breaking the rest of the dashboard.

---

## 8. Tooling, Commands & Scheduling

### 8.1 Tooling

**Collector (Python 3.13)**
- `uv` for dependency management
- Deps: `httpx`, `feedparser`, `pydantic`, `pandas`, `python-dotenv`, `apscheduler`, `google-cloud-storage`
- **No API keys required** — all sources are public (no EIA key, no Gaspy key, nothing)

**Frontend (Node 20+)**
- Vite + React 18 + TypeScript
- Deps: `d3` v7, `@types/d3`, `framer-motion`, `clsx`
- Fonts: self-hosted via Fontsource (`@fontsource-variable/fraunces`, `@fontsource-variable/inter-tight`, `@fontsource-variable/jetbrains-mono`)

### 8.2 Makefile

```make
.PHONY: collect dev frontend schedule clean

collect:        ## Run the collector once
	cd collector && uv run python main.py

dev: collect    ## Seed data then start the frontend
	cd frontend && npm run dev

schedule:       ## Run the collector daemon (daily + hourly news)
	cd collector && uv run python scheduler.py

frontend:       ## Frontend only, no collector
	cd frontend && npm run dev

clean:
	rm -f frontend/public/data/snapshot.json
```

### 8.3 Scheduling — two jobs, one daemon

**Job 1 — `bowser-daily`**: daily full collector at `CronTrigger(hour=7, minute=0, timezone='Pacific/Auckland')`. Pulls all 7 sources, writes `snapshot.json`, writes dated archive copy.

**Job 2 — `bowser-news-hourly`**: `IntervalTrigger(hours=1)` runs `refresh_news_only()` which reads the existing `snapshot.json`, fetches fresh news only, updates the `news` field + `generated_at` timestamp, writes back. ~25s per run. Keeps the "last updated" footer clock fresh between daily runs.

Both jobs run in a single `BlockingScheduler`. On daemon startup, the full collector runs immediately so fresh data is available within a minute.

### 8.4 Snapshot writer supports local file and GCS

In `collector/main.py`, read `SNAPSHOT_OUT` from env. If it starts with `gs://`, use `google-cloud-storage` to upload. Otherwise treat it as a local path. Same code, both environments.

### 8.5 Daily archive writer

After every successful full collector run, `_archive()` writes a dated copy of `snapshot.json` to `collector/archive/snapshot-YYYY-MM-DD.json`. Idempotent — same date overwrites itself, so multiple runs in one day don't pollute the archive. Gitignored. The archive accumulates in the background; a future enhancement can read it to build true daily time series from CardLink data (pays off after ~28 days of accumulation).

### 8.6 Stale data guard (frontend)

The frontend reads `generated_at` from snapshot.json and shows `last updated 3h ago` in the **topbar right** using a relative time formatter. **If the snapshot is more than 36 hours old, the timestamp renders in `--down` red as a visual warning.**

---

## 9. Current Build State

All core sections are shipped and working. Git baseline commit: **`ab2b2df`**.

- [x] Collector runs end-to-end with 7 sources, no warnings
- [x] Every source has a passing smoke test
- [x] `make schedule` daemon runs both daily + hourly jobs
- [x] Frontend renders with zero console/TS errors
- [x] Footer "last updated" moved to topbar right, stale guard working
- [x] All fonts self-hosted via Fontsource (no Google CDN)
- [x] Every chart animates on first load, then static
- [x] Waterfall is the most visually striking element (edge-to-edge)
- [x] Every data point has clickable source attribution within two scrolls
- [x] No `console.log`, no commented-out code, no TODOs in committed files
- [x] Git repo initialized with baseline commit
- [x] Separate About page with hash routing
- [x] WCAG AAA color contrast on all text tiers
- [x] Year filter on the 10-year retail chart
- [x] 4-component Provisional waterfall with historical split footnote
- [x] Fuel supply panel with interactive D3 stacked bars + icons + explainer
- [x] 12-week per-fuel sparkcharts with area fills
- [x] Full cream theme with coffee accent

**Not yet done:**
- [ ] Lighthouse performance ≥95 (not measured)
- [ ] Deploy templates (`deploy/Dockerfile.collector`, `deploy/cloudrun-job.yaml`) — exist as stubs only
- [ ] CardLink request to use their data publicly (informal use is fine; formal permission for public deployment is the next step)

---

## 10. Quality Bar

Before declaring any significant change "done", every one of these must remain true:

- [ ] Collector runs end-to-end with no warnings
- [ ] Every source has a passing smoke test
- [ ] `make schedule` daemon logs both next-fire times on startup
- [ ] Frontend renders with zero console errors and zero TS errors
- [ ] Footer "last updated" time stays current; turns red after 36h
- [ ] Page is readable and looks intentional on a 375px-wide mobile viewport
- [ ] All fonts are self-hosted (no FOUT, no Google CDN call)
- [ ] Every chart animates on first load, then is static
- [ ] The waterfall chart is the most visually striking element on the page
- [ ] Every data source is attributed and linked within two scrolls
- [ ] No `console.log`, no commented-out code, no TODOs in committed files
- [ ] WCAG AAA color contrast on all text (≥7:1 for normal, ≥4.5:1 for large)

---

## 11. Tone & Voice

Headlines: short, declarative, slightly editorial.
- "Brent crude at US$101.72."
- "NZ diesel at NZ$3.89/L."
- "Where your pump dollar goes."
- "Ten years of pump prices."
- "How long New Zealand's fuel lasts."

Captions: factual, mono, lowercase where it works.
- "brent + wti · 12-month futures · source: yahoo finance"
- "mbie fuel stocks · days of cover · as at 08 april 2026"
- "last updated 3h ago"

No marketing speak. No "Welcome to Bowser!" No exclamation marks. No emoji.

---

## 12. Data Honesty Rules (earned through iteration)

These rules were learned through actual wrong turns during the build. All are non-negotiable going forward:

1. **Every number has a date**. If it's on the page, the reader must be able to find when it was measured. No undated numbers.
2. **Every source is linked**. If we display a number, readers must be able to click through to the source and verify.
3. **No synthetic data dressed as real**. If we don't have a value, we show `—` or hide the element. We never interpolate, extrapolate, or guess and present the result as measurement.
4. **Disclose lag when it matters**. MBIE Final-week lag, Yahoo futures vs spot distinction, CardLink 24h transaction lag — all explicit in captions or footnotes.
5. **When a "gold standard" source disagrees with reality, switch sources**. The EIA-vs-Yahoo crude incident is the archetypal example: credentials don't override observable truth.
6. **No live-ish animations that aren't actually live**. Count-up on page load is fine (a one-time transition). Continuous random-walk "wiggle" that simulates live market movement is not. Readers trust the numbers to mean what they say.
7. **Prefer fresh-but-partial data over stale-but-complete data**. The waterfall's shift from MBIE Final (5 components, 15-week lag) to MBIE Provisional (4 components, 1-week lag) is the pattern: fewer components is acceptable, stale is not.
8. **Cross-validate when possible**. When two independent sources (Gaspy vs CardLink, CardLink vs MBIE weekly) agree, trust rises. When they disagree, display the difference and explain it.
