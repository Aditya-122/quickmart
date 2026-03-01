# QuickSearch — How the App Works
### A complete guide for Product Managers (no tech background needed)

---

## What is this app?

QuickSearch is a demo of how a grocery delivery app like **Blinkit or Zepto** handles product search. It shows three different ways a user can find products — and how all three work together seamlessly behind the scenes.

Think of it as a working prototype that you can open in a browser, type things in, and immediately see how a real search engine responds.

---

## The Three Parts of the App

```
┌──────────────────────────────────────────────────────┐
│                    BROWSER (React)                   │
│                                                      │
│  [Search Bar]  ←  user types product name           │
│  [AI Bar]      ←  user types a sentence             │
│  [Sidebar]     ←  user clicks filters               │
└───────────────────────────┬──────────────────────────┘
                            │  sends request
                            ▼
┌──────────────────────────────────────────────────────┐
│                  BACKEND (FastAPI / Python)           │
│                                                      │
│  Receives the request, figures out what to search,  │
│  calls the database, formats the response           │
└───────────────────────────┬──────────────────────────┘
                            │  queries
                            ▼
┌──────────────────────────────────────────────────────┐
│              DATABASE (Elasticsearch)                │
│                                                      │
│  Stores all 104 products. Handles search, ranking,  │
│  filtering, and counting.                           │
└──────────────────────────────────────────────────────┘
```

**React** = what you see in the browser (the UI)
**FastAPI** = the middleman that receives your request and talks to the database
**Elasticsearch** = a powerful search database (like Google's engine, but for your product catalog)

---

## What is the "Seed Data" Button?

The **Seed Data** button (top right, with a refresh icon) resets and fills the database from scratch.

### What it actually does — step by step

```
You click "Seed Data"
        │
        ▼
Step 1: DELETE everything currently in the database
        (wipes the old product index clean)
        │
        ▼
Step 2: CREATE a fresh database structure
        (sets up how products will be stored and searched)
        │
        ▼
Step 3: INSERT all 104 mock products
        (loads the pre-written product catalog)
        │
        ▼
Step 4: Show "Successfully indexed 104 products"
```

### What are the 104 products?

They are **realistic fake Indian grocery products** written in code — no real database or supplier. Think of it like a demo catalog. They cover 6 categories:

| Category | Count | Example Products |
|---|---|---|
| Dairy | 20 | Amul Butter, Mother Dairy Milk, Amul Paneer |
| Snacks | 22 | Lay's Chips, Britannia Biscuits, Haldiram's Namkeen |
| Beverages | 20 | Tropicana Juice, Bisleri Water, Red Bull |
| Fruits & Vegetables | 18 | Bananas, Tomatoes, Spinach |
| Personal Care | 14 | Dove Soap, Head & Shoulders, Colgate |
| Household | 14 | Domex Cleaner, Vim Dishwash, Harpic |

Each product has:
- Name, brand, category, subcategory
- Price (sale price + original price + discount %)
- Rating (out of 5)
- In stock or not
- Delivery time (in minutes)
- Tags (keywords that help search find it)
- Description (a short sentence)

### Why does "Seed Data" exist?

Because this is a demo app. If someone accidentally changes the database or the structure needs to be updated, clicking Seed Data restores everything to a clean, known state instantly. In a real app, this button wouldn't exist — real product data comes from a warehouse management system.

---

## How Search Works — The Big Picture

Every search in this app eventually becomes a **question sent to Elasticsearch**. That question has two parts:

1. **Scoring question:** "Which products best match what the user typed?" → products get ranked by relevance
2. **Filter question:** "Which products are strictly allowed?" → hard yes/no rules

Think of it like hiring at a company:
- **Filters** = minimum requirements (must have a degree, must be in Mumbai) — you're out if you don't meet these
- **Scoring** = ranking the remaining candidates (years of experience, skills match) — best candidates go to the top

---

## Search Method 1 — The Main Search Bar

**What it is:** The big search box at the top of the page.

**What the user does:** Types a product name like `"amul"`, `"chips"`, or `"milk"`.

**What they expect:** Relevant products appear as they type.

### How it works

The search bar has a **300ms delay** built in. This means the app waits until the user has stopped typing for 0.3 seconds before searching. This prevents firing a search on every single keystroke — if someone types `"amul butter"`, the app searches once (after they pause), not 11 times (once per character).

Once the search fires, Elasticsearch runs **5 different matching strategies at the same time** and combines their scores:

---

#### Strategy 1 — Exact Name Match (Highest Priority)

**Plain English:** Did the user type the product's exact full name?

- Example: typing `"Amul Dahi 400g"` perfectly matches that one product
- This gets the highest priority score
- Rarely fires in practice (users don't type full product names)
- Think of it like: searching your contacts app for the exact name you saved

---

#### Strategy 2 — Typo-Tolerant Match

**Plain English:** What if the user made a spelling mistake?

- Example: `"amull"` → still finds Amul products (`"amull"` is close enough to `"amul"`)
- Example: `"choclate"` → finds chocolate products
- The system allows **1 wrong character** for medium-length words, **2 wrong characters** for long words
- **Important rule:** The first letter must be correct. So `"xmul"` won't match `"amul"`, but `"amull"` will.

**Why we target word-level, not character-fragment-level:**
An early bug was that typing `"amul"` matched "Domex Multi-Purpose" because the letters `m-u-l` appear inside the word "Multi". We fixed this by making the typo check work on complete words only. So "amul" is now compared against whole words like "Domex", "Multi", "Purpose" — none of which are close enough.

---

#### Strategy 3 — Prefix / Autocomplete Match

**Plain English:** Find products whose names start with what the user typed.

- Example: typing `"am"` → returns all Amul products (all start with "Am")
- Example: typing `"bit"` → finds Bites, Bittergourd
- This is what makes the search feel instant — you don't have to finish the word
- Think of Google's autocomplete, but for product names

**How it's set up:** At index time (when Seed Data runs), the app pre-generates all possible prefixes of each product name and stores them. "Amul Butter" gets stored as "Am", "Amu", "Amul", "Bu", "But", "Butt", "Butte", "Butter". When you type "am", it instantly finds all products that have "am" as a stored prefix.

---

#### Strategy 4 — Brand Name Match

**Plain English:** Did the user type a brand name?

- Example: `"amul"` → returns all 10 Amul products (not just ones with "amul" in the name)
- Example: `"nestle"` → returns all Nestlé products
- Gets a high priority score (second highest) so brand searches always work cleanly

---

#### Strategy 5 — Tags Match (Lowest Priority)

**Plain English:** Does the product's keyword list mention what the user typed?

- Every product has hidden tags like `["dairy", "milk", "protein", "amul"]`
- If you search `"dairy"`, products tagged with "dairy" appear
- This catches semantic matches where the word isn't in the product name
- Gets the lowest score — it's a supporting signal, not the main driver

---

#### The Quality Gate

After scoring, any product with a score below **0.5 out of 10** is thrown out entirely. This prevents low-quality, accidental matches from sneaking into results.

---

### Flow Diagram

```
User types "amul" → pauses 300ms
        │
        ▼
App sends: GET /search?q=amul
        │
        ▼
Elasticsearch runs all 5 strategies simultaneously:
  Strategy 1 (exact name): no exact full-name match → 0 pts
  Strategy 2 (typo match): "amul" matches "Amul" exactly → score
  Strategy 3 (prefix):     names starting with "amul" → score
  Strategy 4 (brand):      brand = "Amul" → high score
  Strategy 5 (tags):       tags contain "amul" → small score
        │
        ▼
Each product gets a total relevance score
        │
        ▼
Products below 0.5 score → discarded
        │
        ▼
Remaining products ranked: highest score first
        │
        ▼
Page 1 of results (20 products per page) sent back
        │
        ▼
Browser renders the product cards
```

### Example

**User types:** `"amul"`

**What comes back (10 products, all Amul):**
```
1. Amul Dahi 400g         — ₹55    ★ 4.6
2. Amul Butter 100g       — ₹56    ★ 4.7
3. Amul Paneer 200g       — ₹85    ★ 4.5
4. Amul Lassi 200ml       — ₹30    ★ 4.2
5. Amul Ghee 1L Jar       — ₹550   ★ 4.8
6. Amul Toned Milk 500ml  — ₹32    ★ 4.3
   ... (4 more Amul products)
```

**What does NOT come back:** Domex Multi-Purpose Disinfectant (even though the letters "mul" appear inside "Multi"). The typo-check compares against full words, so "Multi" ≠ "amul".

---

## Search Method 2 — The Filter Sidebar

**What it is:** The left-side panel with checkboxes for category, brand, price sliders, rating buttons, and an in-stock toggle.

**What the user does:** Clicks to narrow down results without typing anything.

**What they expect:** Results instantly update to only show products that match ALL selected filters.

### How it works

Filters are **hard rules** — they don't affect ranking, they control eligibility. A product either passes every filter or it doesn't appear at all.

The six filters available:

| Filter | What it does | Example |
|---|---|---|
| Category | Only show products from one category | "Snacks" only |
| Brand | Only show products from one brand | "Amul" only |
| Min Price | Only show products at or above this price | ₹100+ |
| Max Price | Only show products at or below this price | Under ₹500 |
| Min Rating | Only show products rated this or higher | 4 stars & above |
| In Stock | Only show currently available products | Toggle on |

All filters work together with AND logic — a product must pass **every** selected filter.

### Live filter counts

When you check "Snacks", notice how the Brand list immediately changes to only show brands that have Snack products? That's because every search response includes **live counts** (called aggregations).

After every search, Elasticsearch counts:
- How many products are in each category (within current results)
- How many products are from each brand (within current results)
- How products are distributed across price ranges
- How many are in stock

The sidebar reads these counts and updates itself. So the numbers you see next to each filter are always accurate for your current search — not just totals across all products.

### Flow Diagram

```
User clicks "Dairy" category checkbox
        │
        ▼
Sidebar calls: onChange({ category: "Dairy" })
        │
        ▼
App merges into current filter state:
  { category: "Dairy", brand: null, max_price: null, ... }
        │
        ▼
App resets to page 1, fires new search
        │
        ▼
Backend receives: GET /search?category=Dairy
        │
        ▼
Elasticsearch: "Only show products where category = Dairy"
  No text scoring needed → returns all Dairy products, sorted by rating
        │
        ▼
Response includes:
  - Dairy products (all of them)
  - Live counts: brands within Dairy, price distribution, etc.
        │
        ▼
Sidebar updates brand list to show only Dairy brands
Results grid shows only Dairy products
```

### Example

**User selects:** Category = Snacks + In Stock = ON

**Request sent:** `GET /search?category=Snacks&in_stock=true`

**What comes back (18 in-stock snack products):**
```
Lay's Classic Salted Chips 26g      — ₹20   ★ 4.3  [In Stock]
Britannia Good Day Cookies 120g     — ₹35   ★ 4.5  [In Stock]
Haldiram's Aloo Bhujia 200g         — ₹65   ★ 4.6  [In Stock]
Kurkure Masala Munch 90g            — ₹20   ★ 4.2  [In Stock]
... (14 more)
```

**Sidebar now shows:** Only brands that have in-stock snack products (Lay's, Britannia, Haldiram's, Kurkure, etc.)

---

## Search Method 3 — The AI Natural Language Bar

**What it is:** The green-bordered search bar below the header, labelled "AI-Powered Natural Language Search".

**What the user does:** Types a plain English sentence like `"show me Amul dairy products under ₹100 that are in stock"`.

**What they expect:** The app understands the sentence, extracts the meaning, and applies the right filters automatically.

### Why this exists

A normal search bar can only match keywords. If you type `"cheap amul dairy under 100"`, a regular search doesn't know that `"cheap"` means "max price = 100" or that `"dairy"` is a category filter.

The AI bar solves this by asking **GPT-4o** (OpenAI's most capable fast model) to read the sentence and extract what the user actually wants.

### How it works — step by step

#### Step 1: Send the sentence to GPT-4o

The app sends the user's sentence to the GPT-4o API with a strict instruction:

> "You are a filter extraction engine. Read this sentence and tell me: what product text should be searched? What category, brand, price range, rating, and stock status did the user mention? Reply ONLY with a JSON object — no explanation."

GPT-4o has a list of valid categories to choose from: `Dairy`, `Snacks`, `Beverages`, `Fruits & Vegetables`, `Personal Care`, `Household`.

**The rules given to GPT-4o:**
- "under ₹100" or "below 100 rupees" → set max_price = 100
- "above ₹200" → set min_price = 200
- "amul" → set brand = "Amul" (capitalised correctly)
- "in stock" or "available" → set in_stock = true
- "highly rated" or "above 4 stars" → set min_rating = 4
- If only filters are mentioned and no actual product → search_text = null

#### Step 2: GPT-4o replies with structured data

For the sentence `"Amul dairy under ₹100 in stock"`, GPT-4o replies:
```json
{
  "search_text": null,
  "filters": {
    "category": "Dairy",
    "brand": "Amul",
    "max_price": 100,
    "min_price": null,
    "min_rating": null,
    "in_stock": true
  }
}
```

No guessing, no regex, no keyword matching — GPT-4o understands natural language and outputs clean structured data.

#### Step 3: Feed into the same search pipeline

Those extracted filters go into the exact same search system as Method 2. The AI bar is just a "smart translator" — the actual search still runs on Elasticsearch.

#### Step 4: What if GPT-4o fails?

The app has a fallback:
- If GPT-4o takes more than 10 seconds → treat the whole sentence as a keyword search
- If GPT-4o returns garbled output → treat the whole sentence as a keyword search
- If no API key is configured → treat the whole sentence as a keyword search

A yellow "Fallback mode" badge appears so the user knows the AI part didn't work.

#### Step 5: Show what was extracted

After the AI runs, the app shows filter badges below the AI bar:
```
[Category: Dairy]  [Brand: Amul]  [Max ₹100]  [In Stock]
```
This is transparent — the user sees exactly what the AI understood from their sentence. If the AI misunderstood something, the user can see it and adjust using the sidebar.

#### Step 6: Sync with the sidebar

The extracted filters also **update the sidebar**. So after an NL search:
- The category "Dairy" is checked in the sidebar
- The in-stock toggle is turned on
- The price slider shows ₹0–₹100

The user can then fine-tune from the sidebar without re-typing the sentence.

### Flow Diagram

```
User types "amul butter in stock" → clicks Search button
        │
        ▼
Frontend sends: POST /nlsearch  { query: "amul butter in stock" }
        │
        ▼
Backend sends to GPT-4o:
  System: "You are a filter extraction engine..."
  User:   "amul butter in stock"
  Mode:   JSON output only, no creative writing, temperature=0
        │
        ▼ (typically < 2 seconds)
GPT-4o replies:
  {
    "search_text": "butter",
    "filters": { "brand": "Amul", "in_stock": true }
  }
        │
        ▼
Backend runs: search_products(q="butter", brand="Amul", in_stock=True)
  → same as if user had typed "butter" AND checked Brand=Amul AND toggled In Stock
        │
        ▼
Response sent back:
  {
    "nl_query": "amul butter in stock",
    "extracted": { "search_text": "butter", "filters": { brand: "Amul", in_stock: true } },
    "results": { products: [...], total: 2, ... },
    "fallback_used": false
  }
        │
        ▼
Frontend:
  - Updates search bar to show "butter"
  - Checks Brand=Amul in sidebar
  - Turns on In Stock toggle
  - Shows badges: [Brand: Amul] [In Stock]
  - Renders 2 product cards
```

### Examples

**Query:** `"show me cheap dairy products under 50 rupees"`
**GPT-4o extracts:** `{ category: "Dairy", max_price: 50 }`
**Results:** 6 Dairy products priced ≤ ₹50

---

**Query:** `"amul butter in stock"`
**GPT-4o extracts:** `{ search_text: "butter", brand: "Amul", in_stock: true }`
**Results:** 2 in-stock Amul butter products

---

**Query:** `"highly rated beverages"`
**GPT-4o extracts:** `{ category: "Beverages", min_rating: 4 }`
**Results:** 14 beverages rated 4.0 or above

---

## Combined Example — All Three Methods Together

This is the real power of the app: all three methods work simultaneously. They all write into the same shared state and fire one unified search.

### Scenario

The user wants to find **in-stock Amul snacks, under ₹100, with at least 4 stars, matching "chips"**.

They get there in three steps:

---

**Step 1 — AI bar sets the foundation**

User types: `"Amul snacks in stock under 100 rupees"`

GPT-4o extracts → App state becomes:
```
Search text: (empty)
Filters:
  category  = Snacks
  brand     = Amul
  max_price = 100
  in_stock  = true
```

Results: All in-stock Amul snacks under ₹100 (ranked by rating, no keyword scoring)

---

**Step 2 — Sidebar adds rating filter**

User clicks `"★ 4 & above"` in the sidebar.

App state becomes:
```
Search text: (empty)
Filters:
  category   = Snacks
  brand      = Amul
  max_price  = 100
  in_stock   = true
  min_rating = 4      ← newly added
```

Results now narrowed to: Amul snacks, under ₹100, in stock, rated 4+ stars

---

**Step 3 — Search bar adds keyword**

User types `"chips"` in the main search bar.

App state becomes:
```
Search text: "chips"     ← now active
Filters:
  category   = Snacks
  brand      = Amul
  max_price  = 100
  in_stock   = true
  min_rating = 4
```

Now the search switches from "show all matching filters" to "score + filter":
- Only products that pass all 5 filters are even considered
- Among those, products are scored on how well they match "chips"
- Products with score below 0.5 are dropped
- Results ranked: best match for "chips" first

---

### The one unified request that gets sent

```
GET /search?q=chips&category=Snacks&brand=Amul&max_price=100&in_stock=true&min_rating=4
```

Elasticsearch receives this and runs:
```
FILTER (hard rules):
  ✓ category must be "Snacks"
  ✓ brand must be "Amul"
  ✓ price must be ≤ ₹100
  ✓ in_stock must be true
  ✓ rating must be ≥ 4.0

SCORING (ranking):
  + Exact name match for "chips"?     → high score
  + Prefix starts with "chips"?       → high score
  + Typo-close to "chips"?            → medium score
  + Brand exactly "chips"?            → no (brand is "Amul")
  + Tags contain "chips"?             → small score

QUALITY GATE:
  Score < 0.5 → drop from results

SORT:
  Best relevance score first, then highest rating as tiebreaker
```

---

### How the shared state works

All three methods write into the same four variables inside the app:

```
┌───────────────────────────────────────────────────────┐
│               App's shared memory                     │
│                                                       │
│  query      = "chips"      ← set by Search Bar        │
│                                                       │
│  filters = {                                          │
│    category   : "Snacks"   ← set by AI Bar            │
│    brand      : "Amul"     ← set by AI Bar            │
│    max_price  : 100        ← set by AI Bar            │
│    in_stock   : true       ← set by AI Bar            │
│    min_rating : 4          ← set by Sidebar           │
│  }                                                    │
│                                                       │
│  sortBy     = "relevance"                             │
│  page       = 1                                       │
└─────────────────┬─────────────────────────────────────┘
                  │ Any change → automatically re-search
                  ▼
     GET /search?q=chips&category=Snacks&brand=Amul
                 &max_price=100&in_stock=true&min_rating=4
```

Whenever any one of these changes (user types, clicks a filter, clicks a page) — the app automatically fires a new search with the complete current state. There is no "Apply Filters" button — it's always live.

---

## Sorting

The Sort dropdown (top right of results) changes how matched products are ordered:

| Sort Option | What it does |
|---|---|
| Most Relevant | Elasticsearch's relevance score (how well it matches your search) |
| Price: Low to High | Cheapest first, relevance as tiebreaker |
| Price: High to Low | Most expensive first, relevance as tiebreaker |
| Highest Rated | Best rated first, relevance as tiebreaker |

Sorting does not change **which** products appear — it only changes **their order**. Filters still apply.

---

## Pagination

Results come in pages of 20. The page controls at the bottom let users navigate. The backend always knows the total count (`total`) and total number of pages (`total_pages`) and sends them with every response. The frontend just reads these and renders the page buttons — no client-side math needed.

---

## Summary — What Each Part Owns

| Part | Technology | Responsibility |
|---|---|---|
| Search bar (header) | React — 300ms debounce | Takes user's keyword, sends to backend |
| AI search bar | React + GPT-4o API | Converts a sentence into structured filters |
| Filter sidebar | React | Lets user click to add hard filters; shows live counts |
| Results grid | React | Displays product cards + pagination |
| Backend API | FastAPI (Python) | Validates requests, calls Elasticsearch, formats response |
| Search engine | Elasticsearch | Scores, filters, ranks, counts products |
| Product data | mock_data.py | 104 hardcoded demo products |
| AI translator | llm_filter.py + OpenAI | Reads sentence → outputs JSON filters |
| Index setup | indexer.py | Defines how products are stored; Seed Data runs this |

---

## Glossary — Terms Explained Simply

| Term | Plain English |
|---|---|
| **Elasticsearch** | A database designed specifically for search. Faster and smarter than a regular database for finding things. |
| **Index** | Elasticsearch's name for a collection of documents. Our index is called "products". Think of it as a spreadsheet of all 104 products. |
| **Seed Data** | Loading the demo product catalog into the database from scratch. Like filling a blank spreadsheet with sample data. |
| **Relevance score** | A number Elasticsearch gives each product to say "how good a match is this for what the user typed". Higher = better match. |
| **Aggregations** | Live statistics about the current results (e.g. "there are 10 Amul products, 6 Mother Dairy products in these results"). Used to power the sidebar counts. |
| **Filter** | A hard yes/no rule. A product must pass every filter or it's excluded. Does not affect ranking. |
| **Debounce** | Waiting a short time (300ms) after the user stops typing before firing the search. Prevents firing 10 searches while the user types one word. |
| **Fallback** | A backup plan. If GPT-4o fails for any reason, the AI search bar treats the sentence as a plain keyword search instead of crashing. |
| **GPT-4o** | OpenAI's fast, intelligent AI model. Used here only to translate a sentence into a JSON structure. It doesn't do the actual searching. |
| **min_score** | A quality cutoff. Products with a relevance score below 0.5 are dropped from results entirely. Prevents junk matches. |
| **Autocomplete** | The ability to find products when you've only typed the beginning of a word. "am" finds "Amul". |
