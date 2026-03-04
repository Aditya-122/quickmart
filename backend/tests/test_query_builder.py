"""
Pure unit tests for the three stateless functions in search.py.

  _build_filter_clauses  — converts API params → ES filter clauses
  _build_query           — assembles the full ES query body (boosts, sort, aggs)
  _format_response       — reshapes raw ES response → API response dict

No Elasticsearch or network required. All assertions are on plain Python dicts.
"""

import math
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from search import _build_filter_clauses, _build_query, _format_response


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _should_clauses(q="amul"):
    """Return the should array from _build_query for the given query."""
    return _build_query(q, [], "relevance")["query"]["bool"]["should"]


def _clause_by_field(should, *, match_field=None, term_field=None):
    """Find the first clause matching either a match or term on the given field."""
    for c in should:
        if match_field and "match" in c and match_field in c["match"]:
            return c
        if term_field and "term" in c and term_field in c["term"]:
            return c
    raise AssertionError(
        f"No clause found for match_field={match_field!r} term_field={term_field!r}"
    )


EMPTY_AGGS = {
    "categories": {"buckets": []},
    "brands": {"buckets": []},
    "price_ranges": {"buckets": []},
    "avg_rating": {"value": None},
    "in_stock_count": {"doc_count": 0},
}


def _make_es_response(hits=None, total=0, aggs=None):
    return {
        "hits": {
            "total": {"value": total, "relation": "eq"},
            "hits": hits or [],
        },
        "aggregations": aggs or EMPTY_AGGS,
    }


# ─────────────────────────────────────────────────────────────────────────────
# _build_filter_clauses
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildFilterClauses:

    def test_no_args_returns_empty_list(self):
        assert _build_filter_clauses() == []

    # ── Individual filter types ───────────────────────────────

    def test_category_adds_term_clause(self):
        clauses = _build_filter_clauses(category="Dairy")
        assert {"term": {"category": "Dairy"}} in clauses

    def test_brand_adds_term_clause(self):
        clauses = _build_filter_clauses(brand="Amul")
        assert {"term": {"brand": "Amul"}} in clauses

    def test_min_price_only_produces_gte(self):
        clauses = _build_filter_clauses(min_price=100)
        price = next(c for c in clauses if "range" in c and "price" in c["range"])
        assert price["range"]["price"] == {"gte": 100}

    def test_max_price_only_produces_lte(self):
        clauses = _build_filter_clauses(max_price=500)
        price = next(c for c in clauses if "range" in c and "price" in c["range"])
        assert price["range"]["price"] == {"lte": 500}

    def test_price_range_produces_single_clause_with_gte_and_lte(self):
        """min + max must be ONE range clause, not two separate clauses."""
        clauses = _build_filter_clauses(min_price=50, max_price=200)
        price_clauses = [c for c in clauses if "range" in c and "price" in c["range"]]
        assert len(price_clauses) == 1
        assert price_clauses[0]["range"]["price"] == {"gte": 50, "lte": 200}

    def test_min_price_none_max_price_none_adds_no_range(self):
        clauses = _build_filter_clauses(min_price=None, max_price=None)
        assert not any("price" in c.get("range", {}) for c in clauses)

    def test_min_rating_produces_range_gte_on_rating(self):
        clauses = _build_filter_clauses(min_rating=4.0)
        rating = next(c for c in clauses if "range" in c and "rating" in c["range"])
        assert rating["range"]["rating"] == {"gte": 4.0}

    def test_in_stock_true_adds_term_clause(self):
        clauses = _build_filter_clauses(in_stock=True)
        assert {"term": {"in_stock": True}} in clauses

    def test_in_stock_false_adds_term_clause(self):
        """Explicitly filtering out-of-stock must still produce a clause."""
        clauses = _build_filter_clauses(in_stock=False)
        assert {"term": {"in_stock": False}} in clauses

    def test_all_six_filters_produce_five_clauses(self):
        """
        category + brand + price_range(covers both min+max) + rating + in_stock = 5
        (price min and max are merged into one range clause)
        """
        clauses = _build_filter_clauses(
            category="Snacks",
            brand="Lays",
            min_price=10,
            max_price=100,
            min_rating=3.5,
            in_stock=True,
        )
        assert len(clauses) == 5


# ─────────────────────────────────────────────────────────────────────────────
# _build_query  — no-query path
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildQueryNoText:

    def test_none_query_uses_match_all(self):
        body = _build_query(None, [], "relevance")
        assert body["query"]["bool"]["must"] == [{"match_all": {}}]

    def test_whitespace_query_uses_match_all(self):
        body = _build_query("   ", [], "relevance")
        assert body["query"]["bool"]["must"] == [{"match_all": {}}]

    def test_no_query_has_no_should_key(self):
        body = _build_query(None, [], "relevance")
        assert "should" not in body["query"]["bool"]

    def test_filters_still_applied_on_match_all(self):
        filters = [{"term": {"category": "Dairy"}}]
        body = _build_query(None, filters, "relevance")
        assert body["query"]["bool"]["filter"] == filters


# ─────────────────────────────────────────────────────────────────────────────
# _build_query  — text query structure
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildQueryStructure:

    def test_text_query_uses_bool_should(self):
        body = _build_query("amul", [], "relevance")
        assert "should" in body["query"]["bool"]

    def test_exactly_five_should_clauses(self):
        assert len(_should_clauses()) == 5

    def test_outer_minimum_should_match_is_1(self):
        """At least one of the 5 strategies must produce a match."""
        body = _build_query("amul", [], "relevance")
        assert body["query"]["bool"]["minimum_should_match"] == 1

    def test_filters_go_into_bool_filter_not_should(self):
        """Filters must be hard gates (bool.filter), never scoring clauses."""
        filters = [{"term": {"category": "Dairy"}}]
        body = _build_query("amul", filters, "relevance")
        assert body["query"]["bool"]["filter"] == filters
        for clause in body["query"]["bool"]["should"]:
            assert clause != {"term": {"category": "Dairy"}}


# ─────────────────────────────────────────────────────────────────────────────
# _build_query  — boost values
# Tests verify each strategy's boost so changes to scoring config are caught.
# ─────────────────────────────────────────────────────────────────────────────

class TestBoostValues:
    """
    Boost hierarchy (highest → lowest):
      3.0  exact full-name term match   (name.keyword)
      2.5  brand exact match            (brand)
      2.0  edge n-gram prefix match     (name)
      1.0  typo-tolerant fuzzy match    (name.text)
      0.8  tags keyword match           (tags)
    """

    def test_exact_name_keyword_boost_is_3(self):
        clause = _clause_by_field(_should_clauses(), term_field="name.keyword")
        assert clause["term"]["name.keyword"]["boost"] == 3

    def test_brand_term_boost_is_2_5(self):
        clause = _clause_by_field(_should_clauses(), term_field="brand")
        assert clause["term"]["brand"]["boost"] == 2.5

    def test_prefix_ngram_boost_is_2(self):
        clause = _clause_by_field(_should_clauses(), match_field="name")
        assert clause["match"]["name"]["boost"] == 2

    def test_typo_fuzzy_boost_is_1(self):
        clause = _clause_by_field(_should_clauses(), match_field="name.text")
        assert clause["match"]["name.text"]["boost"] == 1

    def test_tags_boost_is_0_8(self):
        clause = _clause_by_field(_should_clauses(), match_field="tags")
        assert clause["match"]["tags"]["boost"] == 0.8

    def test_brand_boost_exceeds_prefix_boost(self):
        """Brand (2.5) > prefix (2.0): typing a brand name surfaces brand products first."""
        should = _should_clauses()
        brand_boost = _clause_by_field(should, term_field="brand")["term"]["brand"]["boost"]
        prefix_boost = _clause_by_field(should, match_field="name")["match"]["name"]["boost"]
        assert brand_boost > prefix_boost

    def test_prefix_boost_exceeds_typo_boost(self):
        """Prefix (2.0) > typo (1.0): partial prefix matches rank above fuzzy accidents."""
        should = _should_clauses()
        prefix_boost = _clause_by_field(should, match_field="name")["match"]["name"]["boost"]
        typo_boost = _clause_by_field(should, match_field="name.text")["match"]["name.text"]["boost"]
        assert prefix_boost > typo_boost

    def test_typo_boost_exceeds_tags_boost(self):
        """Name matches (1.0) outrank tag matches (0.8)."""
        should = _should_clauses()
        typo_boost = _clause_by_field(should, match_field="name.text")["match"]["name.text"]["boost"]
        tags_boost = _clause_by_field(should, match_field="tags")["match"]["tags"]["boost"]
        assert typo_boost > tags_boost


# ─────────────────────────────────────────────────────────────────────────────
# _build_query  — typo-tolerance settings
# ─────────────────────────────────────────────────────────────────────────────

class TestTypoToleranceSettings:

    def _text_clause(self):
        return _clause_by_field(_should_clauses(), match_field="name.text")["match"]["name.text"]

    def test_fuzziness_is_auto(self):
        """AUTO = 0 edits for ≤2 chars, 1 for 3–5 chars, 2 for ≥6 chars."""
        assert self._text_clause()["fuzziness"] == "AUTO"

    def test_prefix_length_is_1(self):
        """
        First character must be correct (prefix_length=1).
        Prevents 'xmul' matching 'amul' and similar wild mismatches.
        """
        assert self._text_clause()["prefix_length"] == 1


# ─────────────────────────────────────────────────────────────────────────────
# _build_query  — minimum_should_match on match clauses (anti-leakage)
# ─────────────────────────────────────────────────────────────────────────────

class TestMinimumShouldMatch:
    """
    All three match clauses carry minimum_should_match: "60%".

    For a 3-token query ("Maggi Masala Noodles") this requires ≥2 tokens to
    match in the same document — so "Lays Magic Masala" (only 1 shared token)
    is excluded even though 'masala' appears in both.
    """

    def test_name_text_minimum_should_match_60_pct(self):
        clause = _clause_by_field(_should_clauses(), match_field="name.text")
        assert clause["match"]["name.text"]["minimum_should_match"] == "60%"

    def test_name_ngram_minimum_should_match_60_pct(self):
        clause = _clause_by_field(_should_clauses(), match_field="name")
        assert clause["match"]["name"]["minimum_should_match"] == "60%"

    def test_tags_minimum_should_match_60_pct(self):
        clause = _clause_by_field(_should_clauses(), match_field="tags")
        assert clause["match"]["tags"]["minimum_should_match"] == "60%"

    def test_exact_name_term_has_no_minimum_should_match(self):
        """term clauses are always exact — minimum_should_match doesn't apply."""
        clause = _clause_by_field(_should_clauses(), term_field="name.keyword")
        assert "minimum_should_match" not in clause["term"]["name.keyword"]

    def test_brand_term_has_no_minimum_should_match(self):
        clause = _clause_by_field(_should_clauses(), term_field="brand")
        assert "minimum_should_match" not in clause["term"]["brand"]


# ─────────────────────────────────────────────────────────────────────────────
# _build_query  — autocomplete analyzer
# ─────────────────────────────────────────────────────────────────────────────

class TestAutocompleteAnalyzer:

    def test_prefix_match_uses_autocomplete_search_analyzer(self):
        """
        Query side must use autocomplete_search_analyzer (standard tokenizer),
        NOT the edge-ngram tokenizer used at index time.  Without this, querying
        with the ngram analyzer would generate tokens of the query itself, causing
        over-matching on very short inputs.
        """
        clause = _clause_by_field(_should_clauses(), match_field="name")
        assert clause["match"]["name"]["analyzer"] == "autocomplete_search_analyzer"


# ─────────────────────────────────────────────────────────────────────────────
# _build_query  — sort configurations
# ─────────────────────────────────────────────────────────────────────────────

class TestSortConfig:

    def test_relevance_sort_puts_score_first(self):
        body = _build_query("amul", [], "relevance")
        assert body["sort"][0] == "_score"

    def test_relevance_sort_uses_rating_as_tiebreaker(self):
        body = _build_query("amul", [], "relevance")
        assert body["sort"][1] == {"rating": {"order": "desc"}}

    def test_price_asc_sort(self):
        body = _build_query("amul", [], "price_asc")
        assert body["sort"][0] == {"price": {"order": "asc"}}

    def test_price_asc_uses_score_as_tiebreaker(self):
        body = _build_query("amul", [], "price_asc")
        assert body["sort"][1] == "_score"

    def test_price_desc_sort(self):
        body = _build_query("amul", [], "price_desc")
        assert body["sort"][0] == {"price": {"order": "desc"}}

    def test_rating_sort_puts_rating_first(self):
        body = _build_query("amul", [], "rating")
        assert body["sort"][0] == {"rating": {"order": "desc"}}

    def test_rating_sort_uses_score_as_tiebreaker(self):
        body = _build_query("amul", [], "rating")
        assert body["sort"][1] == "_score"


# ─────────────────────────────────────────────────────────────────────────────
# _build_query  — aggregations
# ─────────────────────────────────────────────────────────────────────────────

class TestAggregations:

    def _aggs(self, q=None):
        return _build_query(q, [], "relevance")["aggregations"]

    def test_aggregations_block_always_present(self):
        assert "aggregations" in _build_query(None, [], "relevance")

    def test_all_five_aggregation_keys_present(self):
        assert set(self._aggs().keys()) == {
            "categories", "brands", "price_ranges", "avg_rating", "in_stock_count"
        }

    def test_categories_is_terms_agg_on_category_field(self):
        assert self._aggs()["categories"] == {"terms": {"field": "category", "size": 20}}

    def test_brands_is_terms_agg_on_brand_field(self):
        assert self._aggs()["brands"] == {"terms": {"field": "brand", "size": 30}}

    def test_price_ranges_has_five_buckets(self):
        buckets = self._aggs()["price_ranges"]["range"]["ranges"]
        assert len(buckets) == 5

    def test_price_ranges_covers_under_50(self):
        buckets = self._aggs()["price_ranges"]["range"]["ranges"]
        assert any(b.get("to") == 50 and "from" not in b for b in buckets)

    def test_price_ranges_covers_above_500(self):
        buckets = self._aggs()["price_ranges"]["range"]["ranges"]
        assert any(b.get("from") == 500 and "to" not in b for b in buckets)

    def test_in_stock_count_is_filter_on_bool_true(self):
        assert self._aggs()["in_stock_count"] == {
            "filter": {"term": {"in_stock": True}}
        }

    def test_aggregations_present_for_text_query_too(self):
        assert "aggregations" in _build_query("amul", [], "relevance")


# ─────────────────────────────────────────────────────────────────────────────
# _format_response
# ─────────────────────────────────────────────────────────────────────────────

class TestFormatResponse:

    def test_total_extracted(self):
        r = _format_response(_make_es_response(total=42), page=1, page_size=20)
        assert r["total"] == 42

    def test_products_list_extracted_from_hits(self):
        source = {"id": "p1", "name": "Amul Butter"}
        r = _format_response(
            _make_es_response(hits=[{"_source": source}], total=1),
            page=1,
            page_size=20,
        )
        assert r["products"] == [source]

    def test_page_and_page_size_echoed(self):
        r = _format_response(_make_es_response(), page=3, page_size=10)
        assert r["page"] == 3
        assert r["page_size"] == 10

    # ── Pagination math ───────────────────────────────────────

    def test_total_pages_rounds_up(self):
        """21 results / page_size 20 = 2 pages (ceiling)."""
        r = _format_response(_make_es_response(total=21), page=1, page_size=20)
        assert r["total_pages"] == 2

    def test_total_pages_exact_multiple(self):
        r = _format_response(_make_es_response(total=40), page=1, page_size=20)
        assert r["total_pages"] == 2

    def test_total_pages_single_result(self):
        r = _format_response(_make_es_response(total=1), page=1, page_size=20)
        assert r["total_pages"] == 1

    def test_total_pages_zero_results(self):
        r = _format_response(_make_es_response(total=0), page=1, page_size=20)
        assert r["total_pages"] == 0

    def test_total_pages_104_products_page_size_20(self):
        """Real dataset: 104 products / 20 = 6 pages (ceiling(5.2) = 6)."""
        r = _format_response(_make_es_response(total=104), page=1, page_size=20)
        assert r["total_pages"] == math.ceil(104 / 20)

    # ── Aggregation reshaping ──────────────────────────────────

    def test_categories_aggregation_reshaped(self):
        aggs = {
            **EMPTY_AGGS,
            "categories": {"buckets": [{"key": "Dairy", "doc_count": 10}]},
        }
        r = _format_response(_make_es_response(aggs=aggs), page=1, page_size=20)
        assert r["aggregations"]["categories"] == [{"key": "Dairy", "count": 10}]

    def test_brands_aggregation_reshaped(self):
        aggs = {
            **EMPTY_AGGS,
            "brands": {"buckets": [{"key": "Amul", "doc_count": 8}]},
        }
        r = _format_response(_make_es_response(aggs=aggs), page=1, page_size=20)
        assert r["aggregations"]["brands"] == [{"key": "Amul", "count": 8}]

    def test_in_stock_count_extracted(self):
        aggs = {**EMPTY_AGGS, "in_stock_count": {"doc_count": 7}}
        r = _format_response(_make_es_response(aggs=aggs), page=1, page_size=20)
        assert r["aggregations"]["in_stock_count"] == 7

    def test_avg_rating_rounded_to_2_decimal_places(self):
        aggs = {**EMPTY_AGGS, "avg_rating": {"value": 4.33333333}}
        r = _format_response(_make_es_response(aggs=aggs), page=1, page_size=20)
        assert r["aggregations"]["avg_rating"] == 4.33

    def test_avg_rating_none_when_es_returns_none(self):
        """No products → ES returns null avg; format_response must propagate None."""
        aggs = {**EMPTY_AGGS, "avg_rating": {"value": None}}
        r = _format_response(_make_es_response(aggs=aggs), page=1, page_size=20)
        assert r["aggregations"]["avg_rating"] is None
