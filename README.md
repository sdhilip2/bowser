# bowser

> The global fuel story, told from New Zealand.

A premium public dashboard connecting global crude oil markets to NZ pump prices.
Built on free regulatory and live data sources. See `CLAUDE.md` for the full v1 spec.

## Quick start

```sh
# 1. Configure env
cp .env.example .env
# edit .env and set EIA_API_KEY

# 2. Run the collector once (produces snapshot.json)
make collect

# 3. Start the frontend
make frontend
```

## Daily refresh

```sh
make schedule     # runs APScheduler daemon, fires daily at 07:00 NZST
```

## Layout

```
collector/   Python data pipeline (EIA, Gaspy, MBIE, News, FX → snapshot.json)
frontend/    React + Vite + D3 dashboard (reads snapshot.json)
deploy/      Cloud Run job templates (not deployed in v1)
```

## Data sources

- **EIA** — Brent + WTI spot prices
- **Gaspy** — Live NZ pump prices
- **MBIE** — Weekly fuel price monitoring (CC BY 4.0 NZ)
- **Google News RSS** — NZ + global oil news
- **ExchangeRate API** — NZD/USD

## Author

Built by Dhilip Subramanian ([@sdhilip](https://x.com/sdhilip)) — The AI Backpacker.
Not affiliated with any government agency.
