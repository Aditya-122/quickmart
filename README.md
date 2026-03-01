# QuickSearch — Elasticsearch-Powered Grocery Search

A production-quality quick-commerce search app (à la Blinkit / Zepto) with:

- **Elasticsearch 8.x** — edge n-gram autocomplete, fuzzy matching, faceted search, all in one query
- **FastAPI** (async) backend
- **React + Vite + Tailwind CSS** frontend
- **GPT-4o** natural language → filter translation

---

## Prerequisites

| Tool | Version |
|---|---|
| Docker + Docker Compose | v2+ |
| Python | 3.11+ |
| Node.js | 18+ |
| npm | 9+ |

---

## Quick Start (3 terminals)

### Terminal 1 — Start Elasticsearch & Kibana
```bash
cd quick-commerce-search
docker compose up -d
```

Wait ~30 seconds for ES to be healthy:
```bash
curl http://localhost:9200/_cluster/health
```

---

### Terminal 2 — Backend
```bash
cd quick-commerce-search/backend

# Copy and fill in your environment variables
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-...

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Seed the index (first run only):
```bash
curl -X POST http://localhost:8000/index/reset
```

---

### Terminal 3 — Frontend
```bash
cd quick-commerce-search/frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Environment Variables

Create `backend/.env` from the example:

```env
ES_HOST=http://localhost:9200
ES_INDEX=products
ES_PORT=9200
KIBANA_PORT=5601
OPENAI_API_KEY=sk-your-key-here      # Required for NL search
OPENAI_MODEL=gpt-4o
FRONTEND_ORIGIN=http://localhost:5173
```

> **Note:** Without `OPENAI_API_KEY`, the ✨ NL Search bar will gracefully fall back to a plain text search using the raw query.

---

## API Endpoints

### `GET /search` — Faceted search
```bash
# Basic text search
curl "http://localhost:8000/search?q=amul"

# With filters
curl "http://localhost:8000/search?q=milk&category=Dairy&max_price=100&in_stock=true"

# Sort by price ascending
curl "http://localhost:8000/search?q=chips&sort_by=price_asc"

# All params:
# q, category, brand, min_price, max_price, min_rating, in_stock
# sort_by: relevance | price_asc | price_desc | rating
# page (default 1), page_size (default 20, max 100)
```

### `POST /nlsearch` — Natural language search
```bash
curl -X POST http://localhost:8000/nlsearch \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me Amul products under ₹100 that are in stock"}'
```

### `POST /index/reset` — Re-seed mock data
```bash
curl -X POST http://localhost:8000/index/reset
```

### `GET /health` — ES cluster health
```bash
curl http://localhost:8000/health
```

---

## Example NL Queries to Try

```
"Amul products under ₹100 that are in stock"
"Cheap snacks below 50 rupees"
"Highly rated beverages above 4 stars"
"Dairy products from Mother Dairy"
"Personal care items from Dove or Pantene"
"Household cleaning supplies under ₹200"
"Fresh fruits and vegetables available now"
"Energy drinks above rating 4"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  React Frontend (Vite, Tailwind) — port 5173         │
│  SearchBar · NLFilterBar · FilterPanel · ResultsGrid │
└────────────────────────┬────────────────────────────┘
                         │ HTTP (proxied)
┌────────────────────────▼────────────────────────────┐
│  FastAPI Backend — port 8000                         │
│  /search  /nlsearch  /index/reset  /health           │
└────────────┬──────────────────┬─────────────────────┘
             │                  │
    ┌────────▼──────┐   ┌───────▼────────┐
    │ Elasticsearch │   │  OpenAI GPT-4o │
    │ port 9200     │   │  (NL → filters)│
    └───────────────┘   └────────────────┘
             │
    ┌────────▼──────┐
    │ Kibana (opt)  │
    │ port 5601     │
    └───────────────┘
```

### Search Strategy (single ES query, `bool`)

| Clause | Type | Boost | Purpose |
|---|---|---|---|
| `name.keyword` exact | `term` | 3× | Exact product name match |
| `name` fuzzy | `match` + fuzziness=1 | 1× | Typo tolerance |
| `name` autocomplete | `match` + edge n-gram | 2× | Partial / prefix search |
| `tags` + `description` | `multi_match` | 0.5× | Semantic breadth |
| Active filters | `filter` | — | Non-scoring hard filters |

Aggregations (returned alongside hits):
- Category counts · Brand counts · Price range buckets · Average rating · In-stock count

---

## Kibana (optional)

Visit [http://localhost:5601](http://localhost:5601) → Dev Tools:

```
GET products/_search
GET products/_count
GET products/_mapping
```

---

## Stopping

```bash
docker compose down          # stop containers
docker compose down -v       # also remove the ES data volume
```
