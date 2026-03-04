"""
Integration tests for every FastAPI endpoint.

The ASGI app is driven through httpx.AsyncClient (no real server).
Elasticsearch is mocked via the autouse fixtures in conftest.py —
tests assert on:
  - HTTP status codes and response shapes
  - The exact ES query body that was sent (index, body, size, from_)
    so regressions in query construction are caught at the API layer too.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from conftest import MOCK_ES_SUGGEST_RESPONSE


# ─────────────────────────────────────────────────────────────────────────────
# /health
# ─────────────────────────────────────────────────────────────────────────────

class TestHealth:

    async def test_returns_200(self, client):
        r = await client.get("/health")
        assert r.status_code == 200

    async def test_body_has_status_ok(self, client):
        assert r.json()["status"] == "ok" if (r := await client.get("/health")) else True

    async def test_body_has_elasticsearch_key(self, client):
        r = await client.get("/health")
        assert "elasticsearch" in r.json()


# ─────────────────────────────────────────────────────────────────────────────
# /search  — happy paths
# ─────────────────────────────────────────────────────────────────────────────

class TestSearchHappyPath:

    async def test_no_params_returns_200(self, client):
        assert (await client.get("/search")).status_code == 200

    async def test_response_has_products_list(self, client):
        r = await client.get("/search")
        assert isinstance(r.json()["products"], list)

    async def test_response_has_pagination_fields(self, client):
        body = (await client.get("/search")).json()
        assert all(k in body for k in ("total", "page", "page_size", "total_pages"))

    async def test_response_has_aggregations(self, client):
        aggs = (await client.get("/search")).json()["aggregations"]
        assert all(k in aggs for k in ("categories", "brands", "price_ranges", "in_stock_count"))

    async def test_page_and_page_size_echoed_in_response(self, client):
        body = (await client.get("/search?page=2&page_size=10")).json()
        assert body["page"] == 2
        assert body["page_size"] == 10

    async def test_text_query_returns_200(self, client):
        assert (await client.get("/search?q=amul")).status_code == 200

    async def test_category_filter_returns_200(self, client):
        assert (await client.get("/search?category=Dairy")).status_code == 200

    async def test_brand_filter_returns_200(self, client):
        assert (await client.get("/search?brand=Amul")).status_code == 200

    async def test_price_range_returns_200(self, client):
        assert (await client.get("/search?min_price=50&max_price=200")).status_code == 200

    async def test_min_rating_filter_returns_200(self, client):
        assert (await client.get("/search?min_rating=4.0")).status_code == 200

    async def test_in_stock_filter_returns_200(self, client):
        assert (await client.get("/search?in_stock=true")).status_code == 200

    async def test_all_sort_options_return_200(self, client):
        for sort in ("relevance", "price_asc", "price_desc", "rating"):
            r = await client.get(f"/search?sort_by={sort}")
            assert r.status_code == 200, f"sort_by={sort!r} failed with {r.status_code}"

    async def test_all_filters_combined_returns_200(self, client):
        url = "/search?q=butter&category=Dairy&brand=Amul&min_price=50&max_price=200&min_rating=4&in_stock=true"
        assert (await client.get(url)).status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# /search  — validation errors
# ─────────────────────────────────────────────────────────────────────────────

class TestSearchValidation:

    async def test_invalid_sort_returns_422(self, client):
        r = await client.get("/search?sort_by=alphabetical")
        assert r.status_code == 422

    async def test_max_price_less_than_min_price_returns_400(self, client):
        r = await client.get("/search?min_price=200&max_price=50")
        assert r.status_code == 400

    async def test_error_message_mentions_price(self, client):
        r = await client.get("/search?min_price=200&max_price=50")
        assert "price" in r.json()["detail"].lower()

    async def test_negative_min_price_returns_422(self, client):
        r = await client.get("/search?min_price=-10")
        assert r.status_code == 422

    async def test_rating_above_5_returns_422(self, client):
        r = await client.get("/search?min_rating=6")
        assert r.status_code == 422

    async def test_page_zero_returns_422(self, client):
        r = await client.get("/search?page=0")
        assert r.status_code == 422

    async def test_page_size_above_100_returns_422(self, client):
        r = await client.get("/search?page_size=200")
        assert r.status_code == 422

    async def test_page_size_zero_returns_422(self, client):
        r = await client.get("/search?page_size=0")
        assert r.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# /search  — ES query body inspection
# Verifies that the correct DSL is sent to Elasticsearch, not just that
# the endpoint returns 200.
# ─────────────────────────────────────────────────────────────────────────────

class TestSearchESQuery:

    def _last_body(self, mock_es):
        """Extract the 'body' kwarg from the last es.search() call."""
        return mock_es.search.call_args.kwargs["body"]

    async def test_text_query_adds_min_score(self, client, inject_mock_es_client):
        """
        min_score=0.5 must be set in the body when q is present.
        It filters accidental low-confidence matches after scoring.
        """
        await client.get("/search?q=amul")
        assert self._last_body(inject_mock_es_client).get("min_score") == 0.5

    async def test_filter_only_search_has_no_min_score(self, client, inject_mock_es_client):
        """
        Without a text query, min_score must NOT be set — every product has
        score 0 from match_all and would be dropped if min_score were applied.
        """
        await client.get("/search?category=Dairy")
        assert "min_score" not in self._last_body(inject_mock_es_client)

    async def test_category_filter_in_bool_filter_clause(self, client, inject_mock_es_client):
        """Category is a hard gate — it must be in bool.filter, not bool.should."""
        await client.get("/search?category=Dairy")
        filter_clauses = self._last_body(inject_mock_es_client)["query"]["bool"]["filter"]
        assert {"term": {"category": "Dairy"}} in filter_clauses

    async def test_brand_filter_in_bool_filter_clause(self, client, inject_mock_es_client):
        await client.get("/search?brand=Amul")
        filter_clauses = self._last_body(inject_mock_es_client)["query"]["bool"]["filter"]
        assert {"term": {"brand": "Amul"}} in filter_clauses

    async def test_price_range_in_bool_filter_clause(self, client, inject_mock_es_client):
        await client.get("/search?min_price=50&max_price=200")
        filter_clauses = self._last_body(inject_mock_es_client)["query"]["bool"]["filter"]
        price_clause = next(c for c in filter_clauses if "range" in c and "price" in c["range"])
        assert price_clause["range"]["price"] == {"gte": 50.0, "lte": 200.0}

    async def test_in_stock_filter_in_bool_filter_clause(self, client, inject_mock_es_client):
        await client.get("/search?in_stock=true")
        filter_clauses = self._last_body(inject_mock_es_client)["query"]["bool"]["filter"]
        assert {"term": {"in_stock": True}} in filter_clauses

    async def test_pagination_offset_passed_to_es(self, client, inject_mock_es_client):
        """Page 3, page_size 10 → from_=20."""
        await client.get("/search?page=3&page_size=10")
        call_kwargs = inject_mock_es_client.search.call_args.kwargs
        assert call_kwargs["from_"] == 20
        assert call_kwargs["size"] == 10

    async def test_text_query_triggers_should_clauses(self, client, inject_mock_es_client):
        """A text query must produce bool.should (scoring path), not bool.must."""
        await client.get("/search?q=butter")
        query = self._last_body(inject_mock_es_client)["query"]["bool"]
        assert "should" in query
        assert "must" not in query

    async def test_filter_only_triggers_match_all(self, client, inject_mock_es_client):
        """No text query → match_all path (bool.must with match_all)."""
        await client.get("/search?category=Snacks")
        query = self._last_body(inject_mock_es_client)["query"]["bool"]
        assert query.get("must") == [{"match_all": {}}]
        assert "should" not in query

    async def test_correct_index_name_used(self, client, inject_mock_es_client):
        await client.get("/search?q=milk")
        assert inject_mock_es_client.search.call_args.kwargs["index"] == "products"


# ─────────────────────────────────────────────────────────────────────────────
# /suggest
# ─────────────────────────────────────────────────────────────────────────────

class TestSuggest:

    @pytest.fixture(autouse=True)
    def use_suggest_response(self, inject_mock_es_client):
        """Override the default ES response with the lighter suggest payload."""
        inject_mock_es_client.search.return_value = MOCK_ES_SUGGEST_RESPONSE

    async def test_returns_200(self, client):
        assert (await client.get("/suggest?q=am")).status_code == 200

    async def test_response_has_suggestions_key(self, client):
        assert "suggestions" in (await client.get("/suggest?q=am")).json()

    async def test_suggestions_is_a_list(self, client):
        assert isinstance((await client.get("/suggest?q=am")).json()["suggestions"], list)

    async def test_suggestion_items_have_name_brand_category(self, client):
        suggestions = (await client.get("/suggest?q=am")).json()["suggestions"]
        for item in suggestions:
            assert "name" in item
            assert "brand" in item
            assert "category" in item

    async def test_missing_q_returns_422(self, client):
        assert (await client.get("/suggest")).status_code == 422

    # ── ES query structure ────────────────────────────────────

    async def test_exactly_7_results_requested(self, client, inject_mock_es_client):
        await client.get("/suggest?q=am")
        assert inject_mock_es_client.search.call_args.kwargs["size"] == 7

    async def test_name_match_uses_autocomplete_search_analyzer(self, client, inject_mock_es_client):
        """
        Must use the SEARCH analyzer (standard), not the INDEX analyzer (edge ngram).
        Without this, the query would generate its own ngram tokens and over-match.
        """
        await client.get("/suggest?q=am")
        body = inject_mock_es_client.search.call_args.kwargs["body"]
        should = body["query"]["bool"]["should"]
        name_clause = next(c for c in should if "match" in c and "name" in c["match"])
        assert name_clause["match"]["name"]["analyzer"] == "autocomplete_search_analyzer"

    async def test_name_match_boost_is_2(self, client, inject_mock_es_client):
        await client.get("/suggest?q=am")
        body = inject_mock_es_client.search.call_args.kwargs["body"]
        should = body["query"]["bool"]["should"]
        name_clause = next(c for c in should if "match" in c and "name" in c["match"])
        assert name_clause["match"]["name"]["boost"] == 2

    async def test_brand_term_boost_is_3(self, client, inject_mock_es_client):
        """
        Brand boost (3) > name boost (2) in suggest.
        Typing 'amul' should surface Amul brand products at the top of the dropdown.
        """
        await client.get("/suggest?q=amul")
        body = inject_mock_es_client.search.call_args.kwargs["body"]
        should = body["query"]["bool"]["should"]
        brand_clause = next(c for c in should if "term" in c and "brand" in c["term"])
        assert brand_clause["term"]["brand"]["boost"] == 3

    async def test_brand_query_is_lowercased(self, client, inject_mock_es_client):
        """
        Brand term query is lowercased (q.lower()) so 'AMUL' matches stored value.
        """
        await client.get("/suggest?q=AMUL")
        body = inject_mock_es_client.search.call_args.kwargs["body"]
        should = body["query"]["bool"]["should"]
        brand_clause = next(c for c in should if "term" in c and "brand" in c["term"])
        assert brand_clause["term"]["brand"]["value"] == "amul"

    async def test_brand_boost_exceeds_name_boost_in_suggest(self, client, inject_mock_es_client):
        await client.get("/suggest?q=am")
        body = inject_mock_es_client.search.call_args.kwargs["body"]
        should = body["query"]["bool"]["should"]
        name_boost = next(c for c in should if "match" in c and "name" in c["match"])["match"]["name"]["boost"]
        brand_boost = next(c for c in should if "term" in c and "brand" in c["term"])["term"]["brand"]["boost"]
        assert brand_boost > name_boost


# ─────────────────────────────────────────────────────────────────────────────
# /nlsearch
# ─────────────────────────────────────────────────────────────────────────────

class TestNLSearch:

    async def test_valid_query_returns_200(self, client):
        r = await client.post("/nlsearch", json={"query": "cheap dairy products"})
        assert r.status_code == 200

    async def test_empty_query_returns_400(self, client):
        assert (await client.post("/nlsearch", json={"query": ""})).status_code == 400

    async def test_whitespace_only_query_returns_400(self, client):
        assert (await client.post("/nlsearch", json={"query": "   "})).status_code == 400

    async def test_missing_query_field_returns_422(self, client):
        assert (await client.post("/nlsearch", json={})).status_code == 422

    async def test_response_has_all_required_fields(self, client):
        r = await client.post("/nlsearch", json={"query": "amul dairy"})
        body = r.json()
        assert all(k in body for k in ("nl_query", "extracted", "results", "fallback_used"))

    async def test_nl_query_echoes_original(self, client):
        original = "amul butter in stock"
        r = await client.post("/nlsearch", json={"query": original})
        assert r.json()["nl_query"] == original

    async def test_results_has_products_key(self, client):
        r = await client.post("/nlsearch", json={"query": "cheap snacks"})
        assert "products" in r.json()["results"]

    async def test_fallback_used_is_boolean(self, client):
        r = await client.post("/nlsearch", json={"query": "dairy under 100"})
        assert isinstance(r.json()["fallback_used"], bool)

    async def test_extracted_field_is_dict(self, client):
        r = await client.post("/nlsearch", json={"query": "amul dairy"})
        assert isinstance(r.json()["extracted"], dict)


# ─────────────────────────────────────────────────────────────────────────────
# /index/reset
# ─────────────────────────────────────────────────────────────────────────────

class TestIndexReset:

    async def test_returns_200(self, client):
        assert (await client.post("/index/reset")).status_code == 200

    async def test_response_has_count(self, client):
        assert "count" in (await client.post("/index/reset")).json()

    async def test_response_has_message(self, client):
        body = (await client.post("/index/reset")).json()
        assert "message" in body
        assert "products" in body["message"].lower()

    async def test_es_index_delete_called(self, client, inject_mock_es_client):
        """Reset must wipe the old index before creating a fresh one."""
        await client.post("/index/reset")
        inject_mock_es_client.indices.delete.assert_called_once()

    async def test_es_index_create_called(self, client, inject_mock_es_client):
        await client.post("/index/reset")
        inject_mock_es_client.indices.create.assert_called_once()

    async def test_es_bulk_called(self, client, inject_mock_es_client):
        """Products must be bulk-indexed after the index is created."""
        await client.post("/index/reset")
        inject_mock_es_client.bulk.assert_called_once()
