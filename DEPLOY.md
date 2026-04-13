# Deploying Bowser

Total monthly cost: **$0**. Everything runs on free tiers.

## Architecture

```
GitHub repo (public)
├── frontend/  ──► Vercel  ──► bowser.vercel.app (+ custom domain)
└── collector/ ──► GitHub Actions (cron)
                       │
                       └─ commits snapshot.json back to repo
                          which auto-triggers a Vercel redeploy
```

- **Vercel Hobby** hosts the static Vite build and serves `snapshot.json`.
- **GitHub Actions** runs the Python collector on a schedule (Vercel Hobby
  doesn't include cron). Two workflows:
  - `.github/workflows/daily-collector.yml` — full refresh, 18:00 UTC
    (≈ 06:00–07:00 NZ, DST dependent).
  - `.github/workflows/hourly-news.yml` — news-only refresh, every hour.
- **Vercel Analytics** (free) tracks page views, unique visitors, countries.

## One-time setup

### 1. Push to GitHub

```bash
cd /Users/dhilipsubramanian/Documents/Fuel
git init                      # skip if already a repo
git add .
git commit -m "initial: bowser v1"
git branch -M main
gh repo create bowser --public --source=. --remote=origin --push
```

Or via the GitHub website: create a public repo, then
`git remote add origin … && git push -u origin main`.

### 2. Generate the first snapshot locally and commit it

Vercel needs `frontend/public/data/snapshot.json` to exist in the repo
before the first deploy (otherwise the frontend loads to an error state
until the first scheduled collector run).

```bash
cd collector
uv sync
uv run python main.py          # writes ../frontend/public/data/snapshot.json
cd ..
git add frontend/public/data/snapshot.json
git commit -m "data: initial snapshot"
git push
```

### 3. Import to Vercel

1. Go to https://vercel.com/new
2. Import the GitHub repo.
3. Vercel reads `vercel.json` at the root — no manual config needed.
   - Build command: `cd frontend && npm run build`
   - Output dir: `frontend/dist`
4. Click **Deploy**. First build takes ~1 minute.
5. You'll get a `*.vercel.app` URL (e.g. `bowser-xyz.vercel.app`).

### 4. Enable Vercel Analytics

In the Vercel dashboard → your project → **Analytics** tab → **Enable**.
The frontend already mounts `<Analytics />` in `src/main.tsx`, so metrics
start flowing on the next deploy. Free tier: 2,500 events/month, plenty
for a portfolio site.

### 5. Add your custom domain (when ready)

Vercel dashboard → project → **Settings → Domains** → add domain. Vercel
shows the DNS records to set at your registrar (either a CNAME to
`cname.vercel-dns.com` or A records). Propagation usually finishes in
minutes. HTTPS is automatic.

### 6. Verify the GitHub Actions cron

- Go to the repo's **Actions** tab.
- You should see **daily-collector** and **hourly-news** listed.
- Manually trigger each once via **Run workflow** to confirm they pass.
- The workflows commit back to `main` as `bowser-bot`, which Vercel picks
  up as a new deploy automatically.

> GitHub Actions cron can be delayed 5–15 minutes under load — the "hourly
> news" job is set to `:05` to avoid the top-of-hour rush.

## Free-tier limits (as of 2026-04)

| Service | Limit | Bowser usage |
|---|---|---|
| Vercel Hobby bandwidth | 100 GB/month | negligible — single static page |
| Vercel Hobby builds | 6,000 min/month | ~30 s × ~25 deploys/day = fine |
| GitHub Actions (public repo) | unlimited minutes | ~2 min × 25 runs/day |
| Vercel Analytics | 2,500 events/month | ample for a portfolio site |

Public repos get **unlimited** Actions minutes, which is why we picked
public over private.

## Local dev still works the same

The schedulers in `collector/scheduler.py` are now only used for local
development (`make scheduler` or however you run it). Production uses
GitHub Actions instead. Nothing else changed — `uv run python main.py`
still writes the snapshot locally for dev.

## Troubleshooting

**Frontend shows "error loading snapshot"** — make sure
`frontend/public/data/snapshot.json` is committed to the repo. The
gitignore rule was removed specifically so Vercel can serve it.

**Actions workflow fails on `git push`** — check that **Settings → Actions
→ General → Workflow permissions** is set to **Read and write**.

**Cron fires but no commit** — expected when no data changed (the step
prints `no changes` and exits cleanly).

**Snapshot stale in prod** — trigger the workflow manually from the
Actions tab. If that works, the schedule is probably just queued.
