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

**Multi-word protection (`minimum_should_match: "60%"`):**
For a multi-word query like `"Maggi Masala Noodles"` (3 words), at least 60% of those words — meaning 2 out of 3 — must match in the same product. This stopped a bug where searching "Maggi Masala Noodles" returned Lays Magic Masala (only 1 word, "Masala", matched). 60% means you need a real match, not an accidental one.

---

#### Strategy 3 — Prefix / Autocomplete Match

**Plain English:** Find products whose names start with what the user typed.

- Example: typing `"am"` → returns all Amul products (all start with "Am")
- Example: typing `"bit"` → finds Bites, Bittergourd
- This is what makes the search feel instant — you don't have to finish the word
- Think of Google's autocomplete, but for product names

**How it's set up:** At index time (when Seed Data runs), the app pre-generates all possible prefixes of each product name and stores them. "Amul Butter" gets stored as "Am", "Amu", "Amul", "Bu", "But", "Butt", "Butte", "Butter". When you type "am", it instantly finds all products that have "am" as a stored prefix.

**Multi-word protection:** Same `minimum_should_match: "60%"` rule applies. Typing `"maggi masala"` won't return every product that starts with "ma" — both words need a prefix hit in the same product.

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
- **Multi-word protection:** Same `minimum_should_match: "60%"` rule applies here too, so a broad tag like "masala" alone can't pull in unrelated products when the query has multiple words.

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

## Search Method 1b — The Autosuggest Dropdown

**What it is:** The live suggestion list that drops down as you type in the search bar.

**What the user does:** Types 2 or more characters — suggestions appear within 150ms.

**What they expect:** Clicking a suggestion gives immediately relevant results — not a jumble of loosely related products.

### How it works

The autosuggest runs **in parallel** with the main search, but faster. Two separate timers fire on every keystroke:

| Timer | Delay | What it does |
|---|---|---|
| Suggestion timer | 150ms | Calls `GET /suggest?q=...` → updates the dropdown |
| Search timer | 300ms | Calls `GET /search?q=...` → updates the product grid |

The suggestion endpoint returns up to **7 results**, each with name, brand, and category. These are powered by the same edge n-gram prefix index described in Strategy 3 — the tokens are pre-built at index time, so lookups are near-instant.

The dropdown shows:
- Product name with your typed characters **bolded**
- A colour-coded category badge (blue = Dairy, orange = Snacks, etc.)

### What clicking a suggestion does — Blinkit/Zepto style

This is the key difference from a basic search box. When you click "Maggi Masala Noodles 70g":

```
User clicks suggestion
        │
        ▼
Search bar fills with: "Maggi Masala Noodles 70g"
        │
        ▼
Category filter silently applied: "Noodles & Pasta"
        │
        ▼
One unified search fires:
  q="Maggi Masala Noodles 70g" + category="Noodles & Pasta"
        │
        ▼
Results: Maggi noodle variants first,
         then similar products in that category
        │
        ▼
"Noodles & Pasta" chip appears in the filter sidebar
  (user can click × to remove it and widen the scope)
```

**Why not just search by brand?** Searching "Maggi" (brand only) returns every Maggi product — butter, ketchup, sauces, noodles all mixed together. Scoping by the suggestion's category gives results that match exactly what the user was looking at in the dropdown.

**Why not just use the full product name as a plain text query?** Searching "Maggi Masala Noodles 70g" tokenises into 4 words. Even with `minimum_should_match: "60%"`, a loose match might surface unrelated products. Adding the category filter as a hard gate eliminates the ambiguity entirely.

### The dropdown-stays-open problem (and the fix)

When you type, the 300ms search timer fires and updates the `query` state in the app. React then pushes this back as a new `value` prop to the SearchBar. Without a guard, the `useEffect` watching that prop would close the dropdown every time the main search fired — killing the suggestions while you're still typing.

The fix: a `isTypingRef` flag (a React ref, not state — it doesn't cause re-renders). It's set to `true` on every keystroke, then the `useEffect` checks it and skips the dropdown-close logic if the change came from the user's own typing.

### Flow Diagram

```
User types "mag" → 150ms pause
        │
        ├─► GET /suggest?q=mag
        │         │
        │         ▼
        │   Elasticsearch: prefix match on "mag"
        │         │
        │         ▼
        │   Returns 7 suggestions:
        │     "Maggi Masala Noodles 70g"  [Noodles & Pasta]
        │     "Maggi Atta Noodles 75g"    [Noodles & Pasta]
        │     "Magic Masala Lays 26g"     [Snacks]
        │     ... (4 more)
        │         │
        │         ▼
        │   Dropdown renders with bold "mag" highlights
        │
        └─► GET /search?q=mag (300ms, updates product grid in background)

User clicks "Maggi Masala Noodles 70g"
        │
        ▼
SearchBar: localValue = "Maggi Masala Noodles 70g", dropdown closes
        │
        ▼
App: query = "Maggi Masala Noodles 70g"
     filters.category = "Noodles & Pasta"
        │
        ▼
GET /search?q=Maggi+Masala+Noodles+70g&category=Noodles+%26+Pasta
        │
        ▼
Results: Maggi noodle variants, highly ranked — no irrelevant products
```

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

Results come in pages of 20. The page controls at the bottom let users navigate. The backend always knows the total count (`total`) and total number of pa
ges (`total_pages`) and sends them with every response. The frontend just reads these and renders the page buttons — no client-side math needed.

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

## Technology Stack — How Each Method Works

This section maps every user action to the exact technology handling it, with a logical explanation of why each piece exists.

---

### Main Search Bar

**Logical flow:**
```
Keystroke → React debounce (300ms) → Axios GET /search → FastAPI validates
→ Elasticsearch bool query (5 strategies) → min_score filter → JSON → React renders cards
```

| Layer | Technology | Logical explanation |
|---|---|---|
| Keystroke capture | React `useState` + `onChange` handler | Every keystroke updates `localValue` instantly (UI feels responsive), but the network call is deferred |
| Debounce | `setTimeout` (300ms) + `clearTimeout` on every key | Cancels the previous timer each keystroke. Network call only fires after the user pauses 300ms. Typing "amul butter" fires 1 request, not 11 |
| HTTP call | Axios `GET /search?q=...` | Query string, filters, sort, and page are all sent as URL parameters in one request |
| Input validation | FastAPI + Pydantic | Every param is type-checked before ES is called. `min_price ≥ 0`, `sort_by` must be one of 4 values, `page_size` capped at 100. Bad input returns 400 without touching the database |
| Query container | Elasticsearch `bool` query | Groups clauses into `should` (scoring — optional matches that add points) and `filter` (hard rules — mandatory pass/fail). Separating them keeps ranking clean and lets ES cache filters |
| Exact name match | `term` on `name.keyword` field (boost 3) | Byte-for-byte string comparison. No tokenisation. Useful when the user types a full product name precisely |
| Typo tolerance | `match` on `name.text` with `fuzziness: "AUTO"`, `prefix_length: 1` (boost 1) | Computes Levenshtein edit distance between query tokens and stored whole words. AUTO = 1 edit for 3–5 char words, 2 for 6+ char words. `prefix_length: 1` means the first letter must be right, preventing wild mismatches |
| Prefix / autocomplete | `match` on `name` (edge n-gram field) with `autocomplete_search_analyzer` (boost 2) | At index time, "Amul Butter" is stored as ["am","amu","amul","bu","but",…]. At query time, the standard analyzer splits "amul but" into whole words which are matched against those n-gram tokens |
| Brand match | `term` on `brand` keyword field (boost 2.5) | Exact match on the brand field. Typing "amul" hits all products where `brand = "amul"` — independent of what's in the product name |
| Tags match | `match` on `tags` text field (boost 0.8) | Standard full-text search over a comma-separated keyword list. Catches semantic matches ("dairy", "protein") not present in product names |
| Anti-leakage | `minimum_should_match: "60%"` on all `match` clauses | For a 3-word query, at least 2 words must match in the same product. Stops single-token coincidences from surfacing irrelevant results (e.g. "masala" alone pulling Lays when searching "Maggi Masala Noodles") |
| Score floor | `min_score: 0.5` in the request body | After all clauses score each product, any product below 0.5 total is discarded. Eliminates accidental low-confidence matches |
| Sort | `sort` array: `_score`, `price`, or `rating` | ES natively sorts documents by a field or computed score. The sort array is ordered — primary sort first, secondary as tiebreaker |
| Pagination | `from_` (skip offset) + `size` (page size = 20) | ES skips the first N results and returns the next page. Standard offset pagination |
| Live sidebar counts | Elasticsearch `aggregations` run in the same query | `terms` agg counts documents per unique category/brand value. `range` agg buckets prices. `filter` agg counts in-stock items. All computed in one round-trip — no second query needed |

---

### Autosuggest Dropdown

**Logical flow:**
```
Keystroke (2+ chars) → React debounce (150ms) → Axios GET /suggest
→ FastAPI → Elasticsearch bool/should (n-gram + brand term) → 7 results
→ dropdown renders → click → App sets query + category filter → unified search
```

| Layer | Technology | Logical explanation |
|---|---|---|
| Faster debounce | `setTimeout` (150ms) separate from the 300ms search timer | Two timers run in parallel on every keystroke. Dropdown at 150ms feels live; main search at 300ms avoids over-fetching. They never interfere with each other |
| Dropdown guard | `isTypingRef = useRef(false)` | A ref (not state) that tracks whether the value change came from the user typing. When the 300ms search debounce fires and pushes a new `value` prop to SearchBar, `useEffect([value])` would normally close the dropdown. The ref skips that close when the change is internal |
| Separate endpoint | `GET /suggest?q=...` (not `/search`) | Returns a lightweight payload: just name, brand, category — no aggregations, no full product fields. Keeps the response small and fast |
| ES query | `bool.should`: `match` on `name` (boost 2) + `term` on `brand` (boost 3) | Two-pronged: the n-gram `match` catches partial words ("mag" → "Maggi"); the brand `term` promotes exact brand matches ("amul" → all Amul products at the top) |
| Edge n-gram index | `edge_ngram` tokenizer, `min_gram: 2`, `max_gram: 20`, on `name` field | At index time, each product name is pre-tokenised into all its leading character sequences. Stored in an inverted index. Query-time lookup is O(1) — the database does zero scanning |
| Search analyzer split | `autocomplete_search_analyzer` (standard tokenizer + lowercase filter) | Applied at query time only. Splits "amul but" into ["amul","but"] — whole words — which are then matched against n-gram tokens. Without this, the query itself would be n-grammed, causing over-matching |
| Result count | `size=7` | Seven suggestions fits naturally in a dropdown without overwhelming the user. Fewer than the full search page (20) |
| Click: fill bar | `setLocalValue(suggestion.name)` | Shows the full selected product name in the search input |
| Click: category scope | `setFilters(prev => ({ ...prev, category: suggestion.category }))` | Applies the suggestion's category as a hard filter — same mechanism as clicking a sidebar checkbox. This scopes results to the relevant product type without the user having to do it manually |
| Click: unified search | `setQuery(suggestion.name)` triggers `useEffect` → `fetchResults` | One search fires with both the name query and the category filter active together |
| Keyboard navigation | `activeIndex` state + `ArrowUp/Down/Enter/Escape` handlers | Standard combobox accessibility. `onMouseDown` (not `onClick`) on list items prevents the input's `onBlur` from firing before the selection is registered |
| Result highlighting | `HighlightMatch` component with regex split | Splits the suggestion name by the typed query using a case-insensitive regex, wraps matching segments in `<span className="font-bold">` |

---

### Filter Sidebar

**Logical flow:**
```
Click filter checkbox → React merges into filter state → same GET /search with new params
→ FastAPI → Elasticsearch bool.filter (hard gates) + aggregations → sidebar counts update
```

| Layer | Technology | Logical explanation |
|---|---|---|
| State merge | `setFilters(prev => ({ ...prev, ...newFilter }))` | Spread operator adds or overwrites one filter key without touching the others. Clicking "Dairy" does not reset your price range or in-stock toggle |
| HTTP request | Same `GET /search` endpoint | Filters are additional URL params. No separate API route needed — the backend handles text + filters in one unified query |
| ES filter clause | `bool.filter` array (separate from `bool.should`) | Filter clauses are evaluated before scoring. They don't add to relevance score — purely include/exclude. ES can cache filter results across queries, making filtered searches faster than scored ones |
| Category / Brand | `term` query on `keyword` typed fields | `keyword` fields store values without tokenisation. "Noodles & Pasta" is one token, not three. `term` does exact, case-sensitive comparison |
| Price range | `range` query with `gte` / `lte` on `float` field | Numeric range query. Elasticsearch stores numeric fields in a BKD tree (a space-efficient structure for range lookups) — `gte 50 and lte 100` resolves in microseconds |
| Rating floor | `range` query with `gte` on `float` field | Same mechanism. `min_rating: 4` means `rating ≥ 4.0` |
| In-stock toggle | `term` query on `boolean` field | Boolean fields are stored as 0/1. `term: { in_stock: true }` matches only stocked products |
| AND logic | All filters inside the same `bool.filter` array | ES applies every clause as a mandatory gate. A product must pass ALL filters. There is no OR between filter types — category AND brand AND price must all pass |
| Live counts | `terms` aggregation on `category`, `brand` | Computes the count of matching documents per unique field value within the current result set. The sidebar numbers always reflect your active search — not all-time totals |
| Price distribution | `range` aggregation with custom bucket definitions | Counts products falling into predefined price bands (Under ₹50, ₹50–₹100, etc.). The bucket boundaries are fixed in the backend |
| In-stock count | `filter` aggregation with `term: { in_stock: true }` | A single-bucket aggregation that counts how many results are in stock. Appears as the number next to the In Stock toggle |

---

### AI Natural Language Bar

**Logical flow:**
```
User types sentence → button click → POST /nlsearch → FastAPI
→ OpenAI GPT-4o (JSON mode, temperature=0) → extract filters dict
→ same Elasticsearch search as Methods 1+2 → response with extracted field
→ React shows filter badges + syncs sidebar
```

| Layer | Technology | Logical explanation |
|---|---|---|
| No debounce | Button click (not keypress) triggers request | The NL bar is for deliberate intent — the user types a complete thought and clicks Search. No need for live feedback during typing |
| HTTP method | `POST /nlsearch` with JSON body `{ "query": "..." }` | Sentences can be long; GET query params have URL length limits. POST body carries the full sentence without truncation |
| LLM model | OpenAI `chat.completions.create`, `model="gpt-4o"` | GPT-4o is the fast, capable model in the GPT-4 family. Chosen for low latency (typically < 2s) and high instruction-following accuracy |
| Temperature | `temperature=0` | Makes the model deterministic — the same input always produces the same JSON output. At temperature=0, GPT samples the single highest-probability token at each step. No randomness in filter extraction |
| JSON mode | `response_format: { type: "json_object" }` | Forces the model to emit only valid JSON. Without this, GPT might prefix the output with "Sure, here's the result:" — breaking `json.loads()` |
| System prompt | Hardcoded instruction with valid category/value constraints | GPT is told exactly which category names are valid strings and what each phrase maps to (e.g. "under ₹100" → `max_price: 100`). Constrains output to Elasticsearch-compatible values |
| Timeout | `asyncio.wait_for(llm_call(), timeout=10)` | Python's async timeout. If OpenAI doesn't respond within 10 seconds, the coroutine is cancelled. The except block then activates fallback mode instead of hanging the user |
| Fallback | `search_text = original_query`, all filters set to null | Treats the full sentence as a plain keyword search. A `fallback_used: true` flag in the JSON response triggers a yellow "Fallback mode" badge on the frontend |
| Filter merge | `handleNLFiltersExtracted` writes to `query` and `filters` React state | Both update in the same React render cycle. One `useEffect` fires and one unified search runs — not two separate searches |
| Badge display | `NLFilterBar` maps over `extracted.filters` | Renders each non-null filter as a removable chip. The user sees exactly what GPT understood — transparent AI |
| Sidebar sync | `FilterPanel` reads from the same `filters` state | The sidebar automatically reflects AI-extracted values. No extra wiring — it reads the same state the NL bar just wrote |

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
| **Edge n-gram** | A technique for breaking a word into all its leading character sequences at index time. "Amul" → ["am","amu","amul"]. Makes prefix search instant because the work is done upfront, not at search time. |
| **minimum_should_match** | An Elasticsearch rule that says "at least X% of the typed words must appear in the same product". Set to 60% here. For a 3-word query, 2 words must match. Prevents single shared words from pulling in unrelated products. |
| **Category scoping** | When you click an autosuggest suggestion, the app silently applies the product's category as a filter alongside the text query. Results are restricted to that category — the same behaviour Blinkit and Zepto use. The user can remove the category chip in the sidebar to widen scope. |
| **isTypingRef** | A React ref (not state) used as a flag to track whether a value change in the search bar came from the user typing or from an external source (like the NL bar). Prevents the dropdown from closing while the user is still typing. |
| **bool.filter vs bool.should** | In Elasticsearch, `filter` clauses are hard gates (pass/fail, no score contribution); `should` clauses are optional matches that add to the relevance score. Filters are also cached by ES for better performance. |
| **temperature=0** | An OpenAI parameter that makes the AI model deterministic — the same input always produces the same output. At 0, the model picks the single most likely next word at every step, with no randomness. Used here so filter extraction is consistent and predictable. |
| **Inverted index** | The core data structure inside Elasticsearch. Instead of "document → words", it stores "word → list of documents containing it". Looking up which products contain "amul" is O(1) — like looking up a word in a book's index rather than reading every page. |
| **Levenshtein distance** | The number of single-character edits (insert, delete, replace) needed to turn one word into another. "amull" → "amul" = 1 edit (delete one "l"). Used by the typo-tolerance strategy to measure how close a misspelling is to a real product name. |
