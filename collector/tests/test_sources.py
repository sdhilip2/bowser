"""Live smoke tests — one per source.

These hit real endpoints and are intended to be run locally / in CI, not
offline. They check shape and non-emptiness, not exact values.
"""
from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")


def test_fx_live():
    from sources import fx

    result = fx.fetch()
    assert result.nzd_per_usd > 0.5
    assert result.nzd_per_usd < 5.0


def test_crude_live():
    from sources import crude

    result = crude.fetch()
    assert len(result.brent.series) > 100
    assert len(result.wti.series) > 100
    assert result.brent.latest > 0
    assert result.wti.latest > 0


def test_cardlink_live():
    from sources import cardlink

    result = cardlink.fetch()
    assert result is not None
    assert result.regular_91.avg > 1.0
    assert result.premium_95.avg > 1.0
    assert result.diesel.avg > 1.0
    assert result.regular_91.count > 0


def test_mbie_live():
    from sources import mbie

    result = mbie.fetch()
    c = result.components
    total = c.importer_cost + c.ets + c.excise + c.gst + c.importer_margin
    assert abs(total - result.adjusted_retail) < 0.5
    assert result.week_ending.count("-") == 2


def test_news_live():
    from sources import news

    result = news.fetch()
    assert len(result.nz) > 0
    assert len(result.global_) > 0
