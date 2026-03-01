import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv(override=True)  # always override so --reload picks up .env changes

from es_client import close_es_client, get_es_client
from indexer import reset_index
from llm_filter import extract_filters_from_nl
from search import INDEX_NAME, search_products

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: connect to ES and auto-seed if the index is empty
    try:
        es = get_es_client()
        await es.ping()
        print("Elasticsearch connected.")
        try:
            result = await es.count(index=INDEX_NAME)
            if result["count"] == 0:
                print("Index empty — seeding mock products...")
                n = await reset_index()
                print(f"Seeded {n} products.")
        except Exception:
            # Index doesn't exist yet on a fresh Bonsai cluster
            print("Index not found — seeding mock products...")
            n = await reset_index()
            print(f"Seeded {n} products.")
    except Exception as exc:
        print(f"WARNING: Could not connect to Elasticsearch on startup: {exc}")
    yield
    # Shutdown: close connection pool
    await close_es_client()
    print("Elasticsearch connection closed.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Quick-Commerce Search API",
    description="Elasticsearch-powered product search for a grocery quick-commerce app.",
    version="1.0.0",
    lifespan=lifespan,
)

_origins = [o.strip() for o in FRONTEND_ORIGIN.split(",")]
_allow_creds = "*" not in _origins  # wildcard + credentials is invalid in CORS spec
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=_allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────
class NLSearchRequest(BaseModel):
    query: str


class NLSearchResponse(BaseModel):
    nl_query: str
    extracted: dict[str, Any]
    results: dict[str, Any]
    fallback_used: bool


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _check_es_health():
    """Raises 503 if Elasticsearch is unreachable."""
    try:
        es = get_es_client()
        if not await es.ping():
            raise ConnectionError("Elasticsearch did not respond to ping.")
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Elasticsearch is unavailable: {exc}",
        ) from exc


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health", summary="Cluster health check")
async def health():
    await _check_es_health()
    es = get_es_client()
    cluster_health = await es.cluster.health()
    return {"status": "ok", "elasticsearch": dict(cluster_health)}


@app.get("/search", summary="Faceted product search")
async def search(
    q: str | None = Query(default=None, description="Search query"),
    category: str | None = Query(default=None),
    brand: str | None = Query(default=None),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    min_rating: float | None = Query(default=None, ge=0, le=5),
    in_stock: bool | None = Query(default=None),
    sort_by: str = Query(
        default="relevance",
        pattern="^(relevance|price_asc|price_desc|rating)$",
        description="Sort order: relevance | price_asc | price_desc | rating",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    await _check_es_health()

    if max_price is not None and min_price is not None and max_price < min_price:
        raise HTTPException(
            status_code=400, detail="max_price must be greater than or equal to min_price."
        )

    try:
        results = await search_products(
            q=q,
            category=category,
            brand=brand,
            min_price=min_price,
            max_price=max_price,
            min_rating=min_rating,
            in_stock=in_stock,
            sort_by=sort_by,
            page=page,
            page_size=page_size,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return results


@app.post("/nlsearch", summary="Natural language → filter search", response_model=NLSearchResponse)
async def nl_search(body: NLSearchRequest):
    await _check_es_health()

    if not body.query or not body.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty.")

    extracted = await extract_filters_from_nl(body.query)

    filters = extracted.get("filters", {})
    search_text = extracted.get("search_text")

    try:
        results = await search_products(
            q=search_text,
            category=filters.get("category"),
            brand=filters.get("brand"),
            min_price=filters.get("min_price"),
            max_price=filters.get("max_price"),
            min_rating=filters.get("min_rating"),
            in_stock=filters.get("in_stock"),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return NLSearchResponse(
        nl_query=body.query,
        extracted=extracted,
        results=results,
        fallback_used=extracted.get("fallback", False),
    )


@app.get("/suggest", summary="Autocomplete suggestions via edge n-grams")
async def suggest(
    q: str = Query(..., min_length=1, max_length=100, description="Partial search query"),
):
    await _check_es_health()
    es = get_es_client()

    try:
        response = await es.search(
            index=INDEX_NAME,
            body={
                "query": {
                    "bool": {
                        "should": [
                            # Primary: prefix match via edge n-gram index on product name.
                            # At index time "Amul Butter" → tokens ["am","amu","amul","bu","but",...].
                            # autocomplete_search_analyzer splits the query into whole words,
                            # which are then matched against those n-gram tokens.
                            {
                                "match": {
                                    "name": {
                                        "query": q,
                                        "analyzer": "autocomplete_search_analyzer",
                                        "boost": 2,
                                    }
                                }
                            },
                            # Secondary: brand exact match (case-insensitive via lowercase keyword).
                            # "amul" → shows all Amul products at the top.
                            {
                                "term": {
                                    "brand": {
                                        "value": q.lower(),
                                        "boost": 3,
                                    }
                                }
                            },
                        ],
                        "minimum_should_match": 1,
                    }
                }
            },
            size=7,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    suggestions = [
        {
            "name": hit["_source"]["name"],
            "brand": hit["_source"]["brand"],
            "category": hit["_source"]["category"],
        }
        for hit in response["hits"]["hits"]
    ]
    return {"suggestions": suggestions}


@app.post("/index/reset", summary="Re-index all mock products")
async def index_reset():
    await _check_es_health()
    try:
        count = await reset_index()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"message": f"Successfully indexed {count} products.", "count": count}


# ── Frontend static files (production only) ───────────────────────────────────
# The Dockerfile copies the Vite build output to ./frontend_dist next to this file.
# In development (Vite dev server on :5173) this directory doesn't exist, so the
# block is skipped and local dev still works normally.
# API routes registered above always match before the catch-all below.
_DIST = Path(__file__).parent / "frontend_dist"
if _DIST.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = _DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(_DIST / "index.html"))
