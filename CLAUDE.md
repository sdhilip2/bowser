# CLAUDE.md — Bowser v1

> **You (Claude Code) are building Bowser v1.** Read this entire file before writing any code. Stick to v1 scope. Do not add features that are not listed here.

---

## 0. How You Should Work (Claude Code directives)

**Use your skills.** Before writing any non-trivial code, check `/mnt/skills/` (or wherever your skills are mounted in this environment) and read the relevant `SKILL.md` files. In particular:

- **`frontend-design`** — load this BEFORE writing any React component, CSS, or design token. The aesthetic direction in §6 is binding; the skill reinforces the principles (no generic AI aesthetics, distinctive typography, intentional motion). Re-read it before each frontend file.
- **Any Python / data skills** available — load before writing the collector.
- **Document creation skills** — only relevant if generating reports, not for v1.

If a skill exists for something you're about to do, **read it first**. Do not work from memory.

**Other working rules:**
- Stop at the checkpoints in §9. Do not blast through the whole build in one shot.
- Run code as you write it. Smoke-test each collector module the moment it exists.
- No `TODO`, no `console.log`, no commented-out code in committed files.
- If you hit a real ambiguity, ask. If it's a minor decision, make it and note it.

---

## 1. Identity

- **Name**: Bowser
- **Why the name**: "Bowser" is Aus/NZ slang for a petrol pump. Locally rooted, globally curious — exactly the AI Backpacker positioning. One sharp word, instantly memorable, mysterious to outsiders.
- **Tagline**: "The global fuel story, told from New Zealand"
- **Author**: Dhilip Subramanian (@sdhilip — The AI Backpacker)
- **Wordmark**: lowercase **bowser** in Fraunces serif. No icon needed in v1.
- **Purpose**: A premium public dashboard that connects global crude oil markets to New Zealand pump prices, built on free regulatory and live data sources. It is a portfolio piece that doubles as a Commerce Commission relevance showcase — it visualises the same MBIE weekly fuel monitoring data the regulator uses.
- **It is NOT**: a clone of fuelwatch.nz, a tanker tracker, or a government tool.

---

## 2. v1 Scope (ship this, nothing more)

Three layers, one page, one scheduled job. That's it.

### Layer A — Global Crude (the "why")
- Brent and WTI spot prices, last 12 months daily, from EIA API.
- One hero D3 line chart with both series, smooth animated draw-in on load.
- Latest price + 24h delta + 30d delta as headline stats.

### Layer B — NZ Retail (the "what")
- Live NZ pump prices from Gaspy Firebase (regular 91, premium 95, diesel).
- National median + cheapest 5 stations table.
- MBIE weekly waterfall chart: Importer Cost → ETS → Excise → GST → Margin → Adjusted Retail Price. **This is the hero of the page** — it is the regulatory story no one else tells well.

### Layer C — News (the "context")
- Two columns: NZ fuel news + global oil news, from Google News RSS.
- Top 8 articles each, with source, time-ago, and link.

### Footer
- Data attributions (EIA, MBIE CC BY 4.0, Gaspy).
- "Not affiliated with any government agency" disclaimer.
- "Built by The AI Backpacker" with X + LinkedIn links.
- A small `last updated: <relative time>` reading from `snapshot.json`.

### Explicitly OUT of v1 (do not build)
- World Bank country comparison
- Flight cancellation panel
- AI risk assessment (Claude API)
- User accounts, alerts, email
- Map view
- Mobile app

---

## 3. Architecture

Keep it boring and cheap.

```
┌─────────────────────────────────────────────────────────────┐
│  Scheduler (APScheduler locally; Cloud Scheduler in prod)   │
│  Triggers collector daily at 07:00 NZST                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Collector (Python)                                         │
│  Pulls EIA, Gaspy, MBIE, News, FX → writes snapshot.json    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
              data/snapshot.json  (single file, ~200 KB)
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  React + Vite frontend (static)                             │
│  Reads snapshot.json on load, renders D3 visualisations     │
└─────────────────────────────────────────────────────────────┘
```

- **No database.** A single JSON snapshot is the entire backend state.
- **No API server in v1.** The frontend fetches `/data/snapshot.json` directly.
- **No auth, no users, no sessions.**
- Local dev: collector writes to `frontend/public/data/snapshot.json`, Vite serves it.
- Production (later): Cloud Run job writes to a GCS bucket, Cloudflare Pages serves the frontend.

---

## 4. Repo Structure

```
bowser/
├── CLAUDE.md                    ← this file
├── README.md
├── Makefile                     ← dev shortcuts (see §8)
├── .env.example
├── .gitignore
│
├── collector/                   ← Python data pipeline
│   ├── pyproject.toml
│   ├── main.py                  ← entrypoint, orchestrates all sources
│   ├── scheduler.py             ← APScheduler daemon (daily cron)
│   ├── sources/
│   │   ├── eia.py               ← Brent + WTI from EIA
│   │   ├── gaspy.py             ← NZ live prices from Firebase
│   │   ├── mbie.py              ← Weekly CSV → waterfall components
│   │   ├── news.py              ← Google News RSS x2
│   │   └── fx.py                ← NZD/USD daily
│   ├── schema.py                ← Pydantic models for snapshot.json
│   └── tests/
│       └── test_sources.py      ← one smoke test per source
│
├── deploy/
│   ├── Dockerfile.collector     ← container for Cloud Run job
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
        ├── App.tsx
        ├── styles/
        │   ├── tokens.css       ← design tokens (see §6)
        │   └── global.css
        ├── components/
        │   ├── Hero.tsx
        │   ├── CrudeChart.tsx           ← D3 line chart
        │   ├── WaterfallChart.tsx       ← D3 waterfall (HERO)
        │   ├── PumpPriceCards.tsx
        │   ├── CheapestStations.tsx
        │   ├── NewsColumn.tsx
        │   └── Footer.tsx
        └── lib/
            ├── format.ts        ← number/date/relative-time formatters
            └── snapshot.ts      ← typed snapshot loader
```

---

## 5. Data Sources (all free, validated)

### 5.1 EIA API — Brent + WTI
- Base: `https://api.eia.gov/v2/petroleum/pri/spt/data/`
- Auth: API key in env (`EIA_API_KEY`)
- Series: `RBRTE` (Brent FOB), `RWTC` (WTI Cushing)
- Pull: last 365 days, daily frequency

### 5.2 Gaspy Firebase — NZ live prices
- Endpoint: `https://gaspy-datamine-stats.firebaseio.com/.json`
- Auth: none
- Returns: ~2,464 stations across 57 brands
- Extract: per-fuel national median, top 5 cheapest per fuel
- **Important**: respect their data — once per scheduled run only.

### 5.3 MBIE Weekly Fuel Monitoring CSV
- URL: `https://www.mbie.govt.nz/assets/Data-Files/Energy/Weekly-fuel-price-monitoring/weekly-table.csv`
- Auth: none (Creative Commons Attribution 4.0 NZ)
- Format: long-format CSV, ~34k rows
- Parse: filter to latest "Final" week, fuels = Regular, Premium 95R, Diesel
- Variables to extract per fuel: Importer cost, ETS, Taxes (excise), GST, Importer margin, Adjusted retail price
- These six values feed the waterfall chart.

### 5.4 Google News RSS x2
- NZ: `https://news.google.com/rss/search?q=New+Zealand+fuel+price&hl=en-NZ&gl=NZ&ceid=NZ:en`
- Global: `https://news.google.com/rss/search?q=global+oil+price+crude&hl=en&gl=US&ceid=US:en`
- Parse with `feedparser`. Take top 8 each. Strip Google redirect from links.

### 5.5 ExchangeRate API — NZD/USD
- `https://open.er-api.com/v6/latest/USD` → `data.rates.NZD`
- Used for Brent USD → NZD conversion in tooltips.

---

## 6. Design Direction — "Editorial Energy Terminal"

This is a **commitment**, not a starting point. Do not drift toward generic dashboard aesthetics. **Read the `frontend-design` skill before touching any UI file.**

**Aesthetic concept**: Imagine the Financial Times' weekend energy supplement crossed with a Bloomberg Terminal. Editorial confidence, data density where it matters, generous negative space everywhere else. Dark base, single warm accent, serif headlines, monospace numerics. Quiet luxury, not flashy.

### 6.1 Design Tokens (`frontend/src/styles/tokens.css`)

```css
:root {
  /* Surfaces — warm near-black, not pure #000 */
  --surface-0: #0b0a08;     /* page background */
  --surface-1: #14110d;     /* card background */
  --surface-2: #1f1a13;     /* elevated card */
  --surface-line: #2a2319;  /* hairline borders */

  /* Ink */
  --ink-100: #f5efe2;       /* primary text — warm off-white */
  --ink-70:  #b8ad96;       /* secondary */
  --ink-40:  #726a58;       /* tertiary, captions */

  /* Single accent — amber, used SPARINGLY */
  --amber-500: #f5a524;
  --amber-300: #fcd34d;
  --amber-glow: #f5a52433;

  /* Semantic — used only in data viz */
  --up:   #6ee7a8;
  --down: #f87171;
  --brent: #f5a524;
  --wti:   #e8e0cc;

  /* Type scale */
  --font-display: 'Fraunces', Georgia, serif;
  --font-body:    'Inter Tight', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;

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
- The waterfall chart breaks the grid — it goes **edge to edge** with a subtle dark gradient bleed on the sides.
- Asymmetric hero: headline left-aligned takes 7 columns, latest crude price card takes 5 columns.
- Hairline borders (1px `--surface-line`) instead of heavy boxes. Cards have no shadow.

### 6.4 Motion Rules
- **One orchestrated page load**: hero headline fades up over 800ms, then crude chart draws its line over 1200ms, then number cards stagger in with 80ms delay each, then waterfall bars rise from baseline with 60ms stagger. Use `framer-motion`.
- D3 line draw-in: animate `stroke-dashoffset` from path length to 0.
- D3 waterfall: bars grow from baseline with `ease-out-expo`, then connector lines draw in.
- Number tickers on hero stats: count up from 0 to value over 1500ms on load. Use `tnum`.
- **No micro-interactions on every element.** Save the motion budget for the hero load.

### 6.5 D3 Specifics
- All charts: pure D3, no Recharts, no Chart.js, no Nivo. The D3 IS the portfolio point.
- React owns the DOM container, D3 owns the SVG inside.
- Axes: thin 1px `--surface-line` lines, no tick marks, labels in `--ink-40` mono.
- No chart legends in boxes — label series inline at the end of each line.
- Waterfall must show running total above each bar in mono numerics, with each segment labeled in NZD c/L.

### 6.6 What this design must NEVER do
- No purple gradients
- No glassmorphism / frosted blur
- No emoji icons
- No rounded-2xl-on-everything
- No "AI assistant" chat bubble in the corner
- No pie charts
- No copy-paste shadcn aesthetic
- No "Powered by" badges
- No light mode toggle in v1

---

## 7. snapshot.json schema

Single file written by the collector, read by the frontend. Strict shape.

```ts
{
  generated_at: string,           // ISO timestamp — drives footer "last updated"
  fx: { nzd_per_usd: number, as_of: string },
  crude: {
    brent: { latest: number, delta_24h_pct: number, delta_30d_pct: number,
             series: [{ date: string, usd: number }] },
    wti:   { latest: number, delta_24h_pct: number, delta_30d_pct: number,
             series: [{ date: string, usd: number }] }
  },
  nz_retail: {
    medians: { regular_91: number, premium_95: number, diesel: number },
    cheapest: {
      regular_91: [{ station: string, brand: string, suburb: string, price: number }],
      premium_95: [...],
      diesel: [...]
    },
    as_of: string
  },
  mbie_waterfall: {
    week_ending: string,
    fuel: "Regular Petrol" | "Premium Petrol 95R" | "Diesel",
    components: {
      importer_cost: number,
      ets: number,
      excise: number,
      gst: number,
      importer_margin: number
    },
    adjusted_retail: number
  },
  news: {
    nz: [{ title: string, source: string, published: string, url: string }],
    global: [{ title: string, source: string, published: string, url: string }]
  }
}
```

The frontend imports a typed loader (`lib/snapshot.ts`) and is strict about shape.

---

## 8. Tooling, Commands & Scheduling

### 8.1 Tooling

**Collector (Python 3.11+)**
- Use `uv` for dependency management.
- Deps: `httpx`, `feedparser`, `pydantic`, `pandas`, `python-dotenv`, `apscheduler`, `google-cloud-storage` (for prod GCS upload).

**Frontend (Node 20+)**
- Vite + React + TypeScript
- Deps: `d3`, `@types/d3`, `framer-motion`, `clsx`
- Fonts: self-hosted via Fontsource (`@fontsource-variable/fraunces`, `@fontsource-variable/inter-tight`, `@fontsource-variable/jetbrains-mono`).

### 8.2 Makefile (build this)

```make
.PHONY: collect dev frontend schedule clean

collect:        ## Run the collector once
	cd collector && uv run python main.py

dev: collect    ## Seed data then start the frontend
	cd frontend && npm run dev

schedule:       ## Run the collector daemon (refreshes daily at 07:00 NZST)
	cd collector && uv run python scheduler.py

frontend:       ## Frontend only, no collector
	cd frontend && npm run dev

clean:
	rm -f frontend/public/data/snapshot.json
```

### 8.3 Scheduling — three modes (build all three)

**Mode 1: One-shot CLI** — `python collector/main.py`
Used during development and as the entrypoint for any external scheduler. Pulls all sources, writes snapshot.json, exits 0 on success or 1 on failure. Logs one line per source: `[eia] ok 365 rows in 1.2s`.

**Mode 2: Local daemon** — `python collector/scheduler.py`
Long-running process using **APScheduler**. Runs the collector immediately on start (so you always have fresh data within a minute of launching), then schedules daily runs at **07:00 NZST**. Use `BlockingScheduler` with `CronTrigger(hour=7, minute=0, timezone='Pacific/Auckland')`. Log every run start, success, and failure. Catch exceptions per source so one bad source never kills the daemon. Print the next scheduled run time on startup so you can verify it's working.

This is what Dhilip will use locally — `make schedule` in one terminal, `make frontend` in another, walk away, and tomorrow morning the dashboard has fresh data.

**Mode 3: Cloud Run job** (template only in v1, do not deploy)
- `deploy/Dockerfile.collector` — slim Python image, installs deps with uv, entrypoint is `python collector/main.py`. Output target is a GCS bucket via env var `SNAPSHOT_OUT=gs://bowser-data/snapshot.json`.
- `deploy/cloudrun-job.yaml` — Cloud Run **Job** (not Service) definition, plus a Cloud Scheduler entry that triggers it daily at 07:00 NZST.
- Just have the files ready so production deploy is one `gcloud` command away.

### 8.4 Snapshot writer must support both local file and GCS

In `collector/main.py`, read `SNAPSHOT_OUT` from env. If it starts with `gs://`, use `google-cloud-storage` to upload. Otherwise treat it as a local path. Same code, both environments.

### 8.5 Stale data guard (frontend)

The frontend reads `generated_at` from snapshot.json and shows `last updated 3h ago` in the footer using a relative time formatter. **If the snapshot is more than 36 hours old, render the timestamp in `--down` red as a visual warning.** This is the user-facing signal that the scheduler is healthy.

---

## 9. Build Order (do this exactly, stop at checkpoints)

1. Repo skeleton + `.gitignore` + `.env.example` + Makefile + README stub
2. Collector schema (`schema.py`) — Pydantic models matching §7
3. Each source module with one smoke test, in this order: `fx.py`, `eia.py`, `gaspy.py`, `mbie.py`, `news.py`
4. `main.py` orchestrator → writes `snapshot.json` (supports local + GCS via `SNAPSHOT_OUT`)
5. `scheduler.py` — APScheduler daemon, daily 07:00 NZST
6. **🛑 CHECKPOINT: Run the collector once. Show me the snapshot.json. Wait for confirmation before touching the frontend.**
7. Frontend scaffold with Vite + tokens.css + global.css + fonts loading (re-read `frontend-design` skill here)
8. `lib/snapshot.ts` typed loader + `lib/format.ts` (relative time formatter for stale-data guard)
9. Components in this order: `Footer`, `PumpPriceCards`, `NewsColumn`, `CrudeChart`, `CheapestStations`, `WaterfallChart`, `Hero`
10. `App.tsx` composes them with the orchestrated page-load motion
11. Polish pass: spacing, typography, hairlines, hover states, stale-data guard
12. **🛑 CHECKPOINT: Lighthouse pass + visual review. Wait for sign-off.**
13. `deploy/` templates (Dockerfile + Cloud Run job yaml). Do not actually deploy.

**Do not skip ahead. Do not build the frontend before the collector produces a real snapshot.**

---

## 10. Quality Bar

Before declaring v1 done, every one of these must be true:

- [ ] Collector runs end-to-end with no warnings, produces a valid snapshot.json
- [ ] Every source has a passing smoke test
- [ ] `make schedule` runs the daemon and visibly logs the next scheduled fire time
- [ ] Frontend renders with zero console errors and zero TS errors
- [ ] Footer shows a relative "last updated" time, turning red after 36h
- [ ] Lighthouse performance ≥ 95 on desktop
- [ ] Page is readable and looks intentional on a 375px-wide mobile viewport
- [ ] All fonts are self-hosted (no FOUT, no Google CDN call)
- [ ] Every chart animates on first load, then is static
- [ ] The waterfall chart is the most visually striking element on the page
- [ ] Every data point has a source attribution within two scrolls
- [ ] No `console.log`, no commented-out code, no TODOs in committed files

---

## 11. Tone & Voice

Headlines: short, declarative, slightly editorial.
- "Brent at $84. Diesel at $2.19."
- "Where your pump dollar goes."
- "The global crude story, this week."

Captions: factual, mono, lowercase where it works.
- "brent crude · 12-month spot · source: eia"
- "last updated 3h ago"

No marketing speak. No "Welcome to Bowser!" No exclamation marks. No emoji.
