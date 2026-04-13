"""APScheduler daemon — two jobs:

  1. Daily full collector at 07:00 NZST (all sources, fresh snapshot)
  2. Hourly news-only refresh (lightweight, only rewrites `news` field)

Per CLAUDE.md §8.3 Mode 2. Exceptions are caught so one bad source never
kills the daemon. On startup the daemon runs a full collection once so
you always have fresh data within a minute of launching.
"""
from __future__ import annotations

import sys
import traceback
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv

from main import main as run_collector
from main import refresh_news_only

TZ = "Pacific/Auckland"


def _safe_run() -> None:
    started = datetime.now().isoformat(timespec="seconds")
    print(f"[scheduler] full run start at {started}", file=sys.stderr)
    try:
        code = run_collector()
        if code == 0:
            print("[scheduler] full run ok", file=sys.stderr)
        else:
            print(f"[scheduler] full run failed exit={code}", file=sys.stderr)
    except Exception:  # noqa: BLE001
        print("[scheduler] full run raised:", file=sys.stderr)
        traceback.print_exc()


def _safe_news_run() -> None:
    started = datetime.now().isoformat(timespec="seconds")
    print(f"[scheduler] news-only run at {started}", file=sys.stderr)
    try:
        code = refresh_news_only()
        if code == 0:
            print("[scheduler] news-only ok", file=sys.stderr)
        else:
            print(f"[scheduler] news-only failed exit={code}", file=sys.stderr)
    except Exception:  # noqa: BLE001
        print("[scheduler] news-only raised:", file=sys.stderr)
        traceback.print_exc()


def build() -> BlockingScheduler:
    load_dotenv("../.env")
    load_dotenv(".env")
    sched = BlockingScheduler(timezone=TZ)
    # Full collector — every day at 07:00 NZST
    sched.add_job(
        _safe_run,
        trigger=CronTrigger(hour=7, minute=0, timezone=TZ),
        id="bowser-daily",
        name="bowser daily full collector",
        misfire_grace_time=3600,
        coalesce=True,
    )
    # News-only refresh — every hour, on the hour
    sched.add_job(
        _safe_news_run,
        trigger=IntervalTrigger(hours=1),
        id="bowser-news-hourly",
        name="bowser hourly news refresh",
        misfire_grace_time=600,
        coalesce=True,
    )
    return sched


def main() -> None:
    sched = build()
    # Eager first run so a freshly-launched daemon always has fresh data
    _safe_run()
    # Log the next scheduled fire time for both jobs so the operator can
    # verify both are wired up.
    for jid in ("bowser-daily", "bowser-news-hourly"):
        job = sched.get_job(jid)
        next_fire = job.trigger.get_next_fire_time(
            None, datetime.now(tz=job.trigger.timezone)
        )
        print(f"[scheduler] {jid} next: {next_fire.isoformat()}", file=sys.stderr)
    print("[scheduler] entering blocking loop (Ctrl+C to stop)", file=sys.stderr)
    try:
        sched.start()
    except (KeyboardInterrupt, SystemExit):
        print("[scheduler] stopped", file=sys.stderr)


if __name__ == "__main__":
    main()
