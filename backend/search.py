import math
import os
from typing import Any

from elasticsearch import AsyncElasticsearch

from es_client import get_es_client

INDEX_NAME = os.getenv("ES_INDEX", "products")

# Minimum relevance score when a text query is present.
# Filters out accidental low-confidence matches.
MIN_SCORE_WITH_QUERY = 0.5


def _build_filter_clauses(
    category: str | None = None,
    brand: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_rating: float | None = None,
    in_stock: bool | None = None,
) -> list[dict]:
    filters: list[dict] = []

    if category:
        filters.append({"term": {"category": category}})
    if brand:
        filters.append({"term": {"brand": brand}})
    if min_price is not None or max_price is not None:
        price_range: dict[str, float] = {}
        if min_price is not None:
            price_range["gte"] = min_price
        if max_price is not None:
            price_range["lte"] = max_price
        filters.append({"range": {"price": price_range}})
    if min_rating is not None:
        filters.append({"range": {"rating": {"gte": min_rating}}})
    if in_stock is not None:
        filters.append({"term": {"in_stock": in_stock}})

    return filters


def _build_query(
    q: str | None,
    filters: list[dict],
    sort_by: str = "relevance",
) -> dict[str, Any]:
    if q and q.strip():
        should_clauses = [
            # Exact full-name match — highest priority
            {"term": {"name.keyword": {"value": q, "boost": 3}}},

            # Fuzzy match on name.text (standard analyzer → whole words).
            # Using name.text instead of name (edge-n-gram field) is critical:
            # fuzziness on edge-n-grams caused "amul" to match the "mul" token
            # from "Multi-Purpose Domex" (edit distance 1). Standard-analyzed
            # whole tokens ("Multi", "Domex") have edit distance >> 1 from "amul".
            # minimum_should_match "60%" means for a 4-token query like
            # "Maggi Masala Noodles 70g", at least 3 tokens must match —
            # so "Magic Masala Lays" (only 1/4 tokens) is no longer returned.
            {
                "match": {
                    "name.text": {
                        "query": q,
                        "fuzziness": "AUTO",
                        "prefix_length": 1,
                        "minimum_should_match": "60%",
                        "boost": 1,
                    }
                }
            },

            # Autocomplete / prefix match via edge n-gram on the name field.
            # minimum_should_match "60%" prevents single-token leakage when the
            # query has multiple words (e.g. "masala" alone matching Lays).
            {
                "match": {
                    "name": {
                        "query": q,
                        "analyzer": "autocomplete_search_analyzer",
                        "minimum_should_match": "60%",
                        "boost": 2,
                    }
                }
            },

            # Brand exact match — useful for "amul", "nestlé", etc.
            {"term": {"brand": {"value": q, "boost": 2.5}}},

            # Tags match (standard text) — only tags, NOT description.
            # Description is too broad: almost every product description
            # contains common English words that match short queries.
            # minimum_should_match "60%" keeps tags relevant for multi-word queries.
            {
                "match": {
                    "tags": {
                        "query": q,
                        "minimum_should_match": "60%",
                        "boost": 0.8,
                    }
                }
            },
        ]
        bool_query: dict[str, Any] = {
            "bool": {
                "should": should_clauses,
                "minimum_should_match": 1,
                "filter": filters,
            }
        }
    else:
        bool_query = {"bool": {"must": [{"match_all": {}}], "filter": filters}}

    sort_config: list[dict | str]
    if sort_by == "price_asc":
        sort_config = [{"price": {"order": "asc"}}, "_score"]
    elif sort_by == "price_desc":
        sort_config = [{"price": {"order": "desc"}}, "_score"]
    elif sort_by == "rating":
        sort_config = [{"rating": {"order": "desc"}}, "_score"]
    else:
        sort_config = ["_score", {"rating": {"order": "desc"}}]

    return {
        "query": bool_query,
        "sort": sort_config,
        "aggregations": {
            "categories": {"terms": {"field": "category", "size": 20}},
            "brands": {"terms": {"field": "brand", "size": 30}},
            "price_ranges": {
                "range": {
                    "field": "price",
                    "ranges": [
                        {"key": "Under ₹50", "to": 50},
                        {"key": "₹50 - ₹100", "from": 50, "to": 100},
                        {"key": "₹100 - ₹250", "from": 100, "to": 250},
                        {"key": "₹250 - ₹500", "from": 250, "to": 500},
                        {"key": "Above ₹500", "from": 500},
                    ],
                }
            },
            "avg_rating": {"avg": {"field": "rating"}},
            "in_stock_count": {"filter": {"term": {"in_stock": True}}},
        },
    }


def _format_response(
    es_response: dict,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    hits = es_response.get("hits", {})
    total = hits.get("total", {}).get("value", 0)
    products = [hit["_source"] for hit in hits.get("hits", [])]

    aggs = es_response.get("aggregations", {})

    categories = [
        {"key": b["key"], "count": b["doc_count"]}
        for b in aggs.get("categories", {}).get("buckets", [])
    ]
    brands = [
        {"key": b["key"], "count": b["doc_count"]}
        for b in aggs.get("brands", {}).get("buckets", [])
    ]
    price_ranges = [
        {"key": b["key"], "count": b["doc_count"]}
        for b in aggs.get("price_ranges", {}).get("buckets", [])
    ]
    avg_rating = aggs.get("avg_rating", {}).get("value")
    in_stock_count = aggs.get("in_stock_count", {}).get("doc_count", 0)

    total_pages = math.ceil(total / page_size) if page_size else 1

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "products": products,
        "aggregations": {
            "categories": categories,
            "brands": brands,
            "price_ranges": price_ranges,
            "avg_rating": round(avg_rating, 2) if avg_rating else None,
            "in_stock_count": in_stock_count,
        },
    }


async def search_products(
    q: str | None = None,
    category: str | None = None,
    brand: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_rating: float | None = None,
    in_stock: bool | None = None,
    sort_by: str = "relevance",
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    es: AsyncElasticsearch = get_es_client()

    filters = _build_filter_clauses(
        category=category,
        brand=brand,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        in_stock=in_stock,
    )

    search_body = _build_query(q, filters, sort_by)
    from_offset = (page - 1) * page_size

    # Apply min_score inside the body — required by ES 7.x client (body= style).
    if q and q.strip():
        search_body["min_score"] = MIN_SCORE_WITH_QUERY

    response = await es.search(
        index=INDEX_NAME,
        body=search_body,
        from_=from_offset,
        size=page_size,
    )
    return _format_response(dict(response), page=page, page_size=page_size)
