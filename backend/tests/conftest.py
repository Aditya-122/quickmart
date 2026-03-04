"""
Shared fixtures for all test modules.

Strategy
--------
- All tests use a mocked AsyncElasticsearch client injected at the module level.
  Because `get_es_client()` checks `if _client is None` first, setting
  `es_client._client = mock` before any call routes every ES operation through
  the same mock — no real network required.
- The LLM filter extractor (`extract_filters_from_nl`) is patched with a
  passthrough that returns the raw query as `search_text` and all filters null,
  so `/nlsearch` tests never call OpenAI.
"""

import sys
import os

# Make `backend/` importable regardless of where pytest is invoked from.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport

import es_client as _es_client_module  # direct reference so we can swap _client


# ── Canonical mock payloads ───────────────────────────────────────────────────

MOCK_PRODUCT = {
    "id": "test-001",
    "name": "Amul Butter 100g",
    "brand": "Amul",
    "category": "Dairy",
    "subcategory": "Butter",
    "price": 56.0,
    "original_price": 62.0,
    "discount_percent": 10,
    "rating": 4.7,
    "in_stock": True,
    "delivery_time_mins": 15,
    "tags": ["dairy", "butter", "amul"],
    "description": "Fresh creamy Amul butter.",
}

# Standard search response (1 hit, full aggregations)
MOCK_ES_SEARCH_RESPONSE = {
    "hits": {
        "total": {"value": 1, "relation": "eq"},
        "hits": [{"_source": MOCK_PRODUCT, "_score": 5.2, "_id": "test-001"}],
    },
    "aggregations": {
        "categories": {"buckets": [{"key": "Dairy", "doc_count": 10}]},
        "brands": {"buckets": [{"key": "Amul", "doc_count": 10}]},
        "price_ranges": {
            "buckets": [
                {"key": "Under \u20b950", "doc_count": 2},
                {"key": "\u20b950 - \u20b9100", "doc_count": 5},
            ]
        },
        "avg_rating": {"value": 4.5},
        "in_stock_count": {"doc_count": 8},
    },
}

# Lightweight response for /suggest (no aggregations)
MOCK_ES_SUGGEST_RESPONSE = {
    "hits": {
        "total": {"value": 2, "relation": "eq"},
        "hits": [
            {
                "_source": {"name": "Amul Butter 100g", "brand": "Amul", "category": "Dairy"},
                "_score": 3.0,
                "_id": "test-001",
            },
            {
                "_source": {"name": "Amul Dahi 400g", "brand": "Amul", "category": "Dairy"},
                "_score": 2.5,
                "_id": "test-002",
            },
        ],
    },
    "aggregations": {},
}


# ── Core fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def mock_es():
    """
    Fresh AsyncMock ES client pre-wired for happy-path responses.
    AsyncMock auto-propagates: mock.indices, mock.cluster, etc. are also AsyncMock.
    """
    mock = AsyncMock()
    mock.ping.return_value = True
    mock.count.return_value = {"count": 104}
    mock.search.return_value = MOCK_ES_SEARCH_RESPONSE
    mock.cluster.health.return_value = {"status": "yellow", "cluster_name": "test"}
    mock.indices.delete.return_value = {}
    mock.indices.create.return_value = {}
    mock.bulk.return_value = {"errors": False, "items": []}
    return mock


@pytest.fixture(autouse=True)
def inject_mock_es_client(mock_es):
    """
    Swap the module-level _client before every test and restore after.
    get_es_client() returns _client if already set, so every module
    (main, search, indexer) that calls get_es_client() gets our mock.
    """
    original = _es_client_module._client
    _es_client_module._client = mock_es
    yield mock_es
    _es_client_module._client = original


@pytest.fixture(autouse=True)
def mock_llm_extract():
    """
    Replace extract_filters_from_nl with a passthrough so no test ever
    calls the real OpenAI API.  Returns search_text = raw query, all filters null.
    """
    async def _passthrough(query: str) -> dict:
        return {
            "search_text": query,
            "filters": {
                "category": None,
                "brand": None,
                "min_price": None,
                "max_price": None,
                "min_rating": None,
                "in_stock": None,
            },
            "fallback": False,
        }

    with patch("main.extract_filters_from_nl", new=_passthrough):
        yield


@pytest_asyncio.fixture
async def client(inject_mock_es_client):
    """
    ASGI test client for the FastAPI app.  Explicitly depends on
    inject_mock_es_client so the mock is active before the lifespan starts.
    """
    from main import app
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c
