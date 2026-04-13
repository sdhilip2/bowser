"""Bowser collector — one-shot entrypoint.

Runs every source, assembles a `Snapshot`, writes it to `SNAPSHOT_OUT`
(either a filesystem path or a gs:// URI). Exits 0 on success, 1 on failure.
Logs one line per source in the shape `[source] ok … in Xs`.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from schema import Snapshot
from sources import cardlink, crude, fx, mbie, mbie_stocks, news

DEFAULT_OUT = "../frontend/public/data/snapshot.json"


def _run(name: str, fn):
    t0 = time.time()
    try:
        result = fn()
        print(f"[{name}] ok in {time.time() - t0:.1f}s", file=sys.stderr)
        return result
    except Exception as exc:  # noqa: BLE001
        print(f"[{name}] FAIL in {time.time() - t0:.1f}s: {exc}", file=sys.stderr)
        raise


def _archive_path(target: str, date_iso: str) -> str:
    """Produce a dated archive path alongside the main snapshot target.

    Local:  `../frontend/public/data/snapshot.json`
            → `archive/snapshot-2026-04-13.json` (relative to collector/)
    GCS:    `gs://bowser-data/snapshot.json`
            → `gs://bowser-data/archive/snapshot-2026-04-13.json`
    """
    if target.startswith("gs://"):
        bucket, _, blob = target[len("gs://") :].partition("/")
        parent, _, _name = blob.rpartition("/")
        base = f"gs://{bucket}"
        if parent:
            base = f"{base}/{parent}"
        return f"{base}/archive/snapshot-{date_iso}.json"
    # Local: always write archive next to the collector dir, not next to
    # the frontend target — the frontend doesn't need to serve the archive.
    return f"archive/snapshot-{date_iso}.json"


def _write(snapshot: Snapshot, target: str) -> None:
    payload = snapshot.model_dump(by_alias=True, mode="json")
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    if target.startswith("gs://"):
        from google.cloud import storage  # local import — only needed in prod

        bucket_name, _, blob_name = target[len("gs://") :].partition("/")
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.upload_from_string(body, content_type="application/json")
        print(f"[write] ok gs://{bucket_name}/{blob_name} ({len(body)} bytes)",
              file=sys.stderr)
        return
    path = Path(target)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    print(f"[write] ok {path} ({len(body)} bytes)", file=sys.stderr)


def _archive(snapshot: Snapshot, target: str) -> None:
    """Save a dated copy so we accumulate a daily history. Idempotent:
    the same date overwrites itself (so re-running the collector on the
    same day doesn't pollute the archive)."""
    payload = snapshot.model_dump(by_alias=True, mode="json")
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    date_iso = datetime.now(timezone.utc).date().isoformat()
    archive_target = _archive_path(target, date_iso)

    if archive_target.startswith("gs://"):
        from google.cloud import storage

        bucket_name, _, blob_name = archive_target[len("gs://") :].partition("/")
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        bucket.blob(blob_name).upload_from_string(body, content_type="application/json")
        print(f"[archive] ok gs://{bucket_name}/{blob_name}", file=sys.stderr)
        return

    path = Path(archive_target)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    print(f"[archive] ok {path}", file=sys.stderr)


def build_snapshot() -> Snapshot:
    fx_result = _run("fx", fx.fetch)
    crude_result = _run("crude", crude.fetch)
    nz_retail = _run("cardlink", cardlink.fetch)
    # Share a single MBIE CSV download between waterfall + historical parsers
    mbie_df = mbie._download()
    waterfall = _run("mbie", lambda: mbie.fetch(df=mbie_df))
    historical = _run("mbie_hist", lambda: mbie.fetch_historical(df=mbie_df, years=10))
    stocks = _run("mbie_stocks", mbie_stocks.fetch)
    news_result = _run("news", news.fetch)
    return Snapshot(
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        fx=fx_result,
        crude=crude_result,
        nz_retail=nz_retail,
        mbie_waterfall=waterfall,
        historical_retail=historical,
        fuel_stocks=stocks,
        news=news_result,
    )


def refresh_news_only() -> int:
    """Update only the news field in an existing snapshot.

    Reads the existing snapshot.json, fetches fresh news, rewrites with
    an updated `generated_at` timestamp. Used by the hourly scheduler
    job so news stays current between daily main runs. Skips silently
    for GCS targets (partial updates there would need compare-and-swap).
    """
    load_dotenv("../.env")
    load_dotenv(".env")
    target = os.environ.get("SNAPSHOT_OUT", DEFAULT_OUT)
    if target.startswith("gs://"):
        return main()  # fall back to full build for GCS
    path = Path(target)
    if not path.exists():
        return main()  # no snapshot yet — full build
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        fresh_news = _run("news", news.fetch)
        data["news"] = fresh_news.model_dump(by_alias=True, mode="json")
        data["generated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        body = json.dumps(data, ensure_ascii=False, indent=2)
        path.write_text(body, encoding="utf-8")
        print(f"[news-refresh] ok {path}", file=sys.stderr)
    except Exception as exc:  # noqa: BLE001
        print(f"[news-refresh] failed: {exc}", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    load_dotenv("../.env")
    load_dotenv(".env")  # fallback
    target = os.environ.get("SNAPSHOT_OUT", DEFAULT_OUT)
    try:
        snapshot = build_snapshot()
        _write(snapshot, target)
        _archive(snapshot, target)
    except Exception as exc:  # noqa: BLE001
        print(f"[main] aborted: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
