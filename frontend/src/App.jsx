import { useState, useEffect, useCallback } from 'react'
import SearchBar from './components/SearchBar'
import NLFilterBar from './components/NLFilterBar'
import FilterPanel from './components/FilterPanel'
import ResultsGrid from './components/ResultsGrid'
import { searchProducts } from './api/search'

const DEFAULT_FILTERS = {
  category: null,
  brand: null,
  min_price: null,
  max_price: null,
  min_rating: null,
  in_stock: null,
}

export default function App() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [sortBy, setSortBy] = useState('relevance')
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const PAGE_SIZE = 20

  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(null)
  const [totalPages, setTotalPages] = useState(1)
  const [aggregations, setAggregations] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchResults = useCallback(async (q, f, sort, pg) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await searchProducts({
        q: q || null,
        ...f,
        sort_by: sort,
        page: pg,
        page_size: PAGE_SIZE,
      })
      setProducts(data.products)
      setTotal(data.total)
      setTotalPages(data.total_pages ?? 1)
      setAggregations(data.aggregations)
    } catch (err) {
      const msg = err?.response?.data?.detail
        || err?.message
        || 'Unable to reach the server. Please try again shortly.'
      setError(msg)
      setProducts([])
      setTotal(null)
      setTotalPages(1)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchResults(query, filters, sortBy, page)
  }, [query, filters, sortBy, page, fetchResults])

  const handleQueryChange = (q) => {
    setQuery(q)
    setPage(1)
  }

  // Called when user clicks (or keyboard-selects) an autosuggest item.
  // Sets the search text to the product name and scopes results to that
  // category — same behaviour as Blinkit / Zepto.
  const handleSuggestionSelect = (suggestion) => {
    setQuery(suggestion.name)
    setFilters(prev => ({ ...prev, category: suggestion.category }))
    setPage(1)
  }

  const handleFilterChange = (newFilter) => {
    setFilters((prev) => ({ ...prev, ...newFilter }))
    setPage(1)
  }

  const handleFilterReset = () => {
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  const handleSortChange = (sort) => {
    setSortBy(sort)
    setPage(1)
  }

  const handleNLFiltersExtracted = (response) => {
    const { extracted } = response
    const f = extracted?.filters || {}
    setQuery(extracted?.search_text || '')
    setFilters({
      category: f.category || null,
      brand: f.brand || null,
      min_price: f.min_price ?? null,
      max_price: f.max_price ?? null,
      min_rating: f.min_rating ?? null,
      in_stock: f.in_stock ?? null,
    })
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col" style={{ WebkitFontSmoothing: 'antialiased' }}>

      {/* ── Utility bar ─────────────────────────────────── */}
      <div className="bg-gray-900 text-gray-400 text-xs py-1.5 hidden md:block border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <p className="text-gray-300">
            Free delivery on orders above ₹199 &nbsp;&middot;&nbsp; Delivery in 10–20 minutes
          </p>
          <div className="flex items-center gap-5">
            <button className="hover:text-white transition-colors">Become a Seller</button>
            <button className="hover:text-white transition-colors">Download App</button>
            <button className="hover:text-white transition-colors">Help</button>
          </div>
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────── */}
      <header className="bg-[#F5F0E8] sticky top-0 z-20 pt-2 pb-1">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-green-500 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">QuickMart</p>
              <p className="text-[10px] sm:text-[11px] text-green-500 font-semibold hidden xs:block">10–20 min</p>
            </div>
          </div>

          {/* Location */}
          <button className="hidden lg:flex items-center gap-2 flex-shrink-0 group">
            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.079 3.7-5.084 3.7-9.327 0-5.11-4.099-9.25-9.25-9.25S2.75 4.14 2.75 9.25c0 4.243 1.756 7.248 3.7 9.327a19.58 19.58 0 002.683 2.282 16.975 16.975 0 001.144.742zM12 13.25a4 4 0 100-8 4 4 0 000 8z" clipRule="evenodd" />
            </svg>
            <div className="text-left leading-tight border-b border-dashed border-gray-300 pb-0.5">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Deliver to</p>
              <p className="text-sm font-bold text-gray-800 group-hover:text-green-600 transition-colors">
                Connaught Place, 110001
              </p>
            </div>
            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Search */}
          <div className="flex-1 min-w-0">
            <SearchBar
              value={query}
              onChange={handleQueryChange}
              onSuggestionSelect={handleSuggestionSelect}
              isLoading={isLoading}
            />
          </div>

        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-4 md:py-6 flex-1 w-full">
        <div className="mb-4">
          <NLFilterBar onFiltersExtracted={handleNLFiltersExtracted} />
        </div>

        {/* ── Mobile: filter button + active chips strip ── */}
        <div className="flex md:hidden items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-4 px-4">
          <button
            onClick={() => setFilterOpen(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm active:bg-gray-50"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {[filters.category, filters.brand, filters.min_price, filters.max_price, filters.min_rating, filters.in_stock].filter(v => v != null).length > 0 && (
              <span className="w-4 h-4 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {[filters.category, filters.brand, filters.min_price, filters.max_price, filters.min_rating, filters.in_stock].filter(v => v != null).length}
              </span>
            )}
          </button>

          {filters.category && (
            <button onClick={() => handleFilterChange({ category: null })}
              className="flex-shrink-0 flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap">
              {filters.category}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
          {filters.brand && (
            <button onClick={() => handleFilterChange({ brand: null })}
              className="flex-shrink-0 flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap">
              {filters.brand}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
          {(filters.min_price != null || filters.max_price != null) && (
            <button onClick={() => handleFilterChange({ min_price: null, max_price: null })}
              className="flex-shrink-0 flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap">
              ₹{filters.min_price ?? 0}–{filters.max_price ?? '600+'}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
          {filters.min_rating != null && (
            <button onClick={() => handleFilterChange({ min_rating: null })}
              className="flex-shrink-0 flex items-center gap-1 text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap">
              {filters.min_rating}★ & above
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
          {filters.in_stock && (
            <button onClick={() => handleFilterChange({ in_stock: null })}
              className="flex-shrink-0 flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap">
              In Stock
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* ── Mobile filter bottom drawer ── */}
        {filterOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setFilterOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] flex flex-col">
              {/* Drawer handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">Filters</h2>
                <button
                  onClick={() => setFilterOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Scrollable filter content */}
              <div className="overflow-y-auto px-5 pb-4">
                <FilterPanel
                  aggregations={aggregations}
                  filters={filters}
                  onChange={handleFilterChange}
                  onReset={() => { handleFilterReset(); setFilterOpen(false) }}
                  isMobile
                />
              </div>
              {/* Done button */}
              <div className="px-5 pb-6 pt-2 border-t border-gray-100">
                <button
                  onClick={() => setFilterOpen(false)}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors"
                >
                  Show Results
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-6 items-start">
          {/* Desktop sidebar */}
          <div className="hidden md:block">
            <FilterPanel
              aggregations={aggregations}
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleFilterReset}
            />
          </div>
          <ResultsGrid
            products={products}
            total={total}
            totalPages={totalPages}
            isLoading={isLoading}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            error={error}
            page={page}
            onPageChange={setPage}
          />
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 pt-12 pb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-white font-extrabold text-lg tracking-tight">QuickMart</span>
              </div>
              <p className="text-sm leading-relaxed mb-5 text-gray-500">
                Groceries, fresh produce, and daily essentials delivered to your door in 10–20 minutes.
              </p>
              <div className="flex flex-col gap-2.5">
                <button className="bg-gray-800 hover:bg-gray-700 transition-colors text-white text-xs px-4 py-2.5 rounded-xl flex items-center gap-2.5 w-fit">
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-gray-400 text-[10px] leading-none mb-0.5">Download on the</p>
                    <p className="font-semibold text-sm leading-none">App Store</p>
                  </div>
                </button>
                <button className="bg-gray-800 hover:bg-gray-700 transition-colors text-white text-xs px-4 py-2.5 rounded-xl flex items-center gap-2.5 w-fit">
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3.18 23.76c.3.17.64.24.99.2l12.6-12.6-3.57-3.57L3.18 23.76zm17.64-11.4c.42-.24.67-.67.67-1.13 0-.46-.25-.89-.67-1.13l-2.8-1.62-3.86 3.86 3.86 3.86 2.8-1.84zM.83 1.07C.32 1.31 0 1.8 0 2.38v19.24c0 .58.32 1.07.83 1.31l12.66-12.66L.83 1.07zm15.49 8.5l-3.57-3.57L.83.07C.64.01.44 0 .24 0 .09 0 0 .01 0 .01l12.6 12.6 3.72-3.04z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-gray-400 text-[10px] leading-none mb-0.5">Get it on</p>
                    <p className="font-semibold text-sm leading-none">Google Play</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-white text-sm font-bold mb-5 tracking-wide">Company</h4>
              <ul className="space-y-3 text-sm">
                {['About Us', 'Careers', 'Press', 'Blog', 'Investors'].map(link => (
                  <li key={link}>
                    <a href="#" className="hover:text-white transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Partners */}
            <div>
              <h4 className="text-white text-sm font-bold mb-5 tracking-wide">For Partners</h4>
              <ul className="space-y-3 text-sm">
                {['Sell on QuickMart', 'Partner Portal', 'Delivery Partner', 'Advertise with Us', 'Franchise'].map(link => (
                  <li key={link}>
                    <a href="#" className="hover:text-white transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Help */}
            <div>
              <h4 className="text-white text-sm font-bold mb-5 tracking-wide">Help & Support</h4>
              <ul className="space-y-3 text-sm">
                {['FAQs', 'Track My Order', 'Return & Refund', 'Contact Us', 'Privacy Policy', 'Terms of Service'].map(link => (
                  <li key={link}>
                    <a href="#" className="hover:text-white transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <p>© 2026 QuickMart Technologies Pvt. Ltd. All rights reserved.</p>
            <p>Registered office: 12th Floor, DLF Cyber Hub, Gurugram, Haryana 122002</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
