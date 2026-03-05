import ProductCard from './ProductCard'

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
]

// Generates a windowed list of page numbers with "..." gaps.
// e.g. page=6, total=20 → [1, '...', 5, 6, 7, '...', 20]
function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = []
  pages.push(1)

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')

  pages.push(total)
  return pages
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className="h-36 sm:h-40 bg-gray-100" />
      <div className="p-3 space-y-2.5">
        <div className="h-3 bg-gray-200 rounded-md w-1/2" />
        <div className="h-4 bg-gray-200 rounded-md w-3/4" />
        <div className="h-3 bg-gray-100 rounded-md w-full" />
        <div className="h-3 bg-gray-100 rounded-md w-5/6" />
        <div className="flex justify-between items-center pt-1">
          <div className="h-5 bg-gray-200 rounded-md w-16" />
          <div className="h-4 bg-gray-100 rounded-md w-12" />
        </div>
        <div className="h-9 bg-gray-200 rounded-xl w-full mt-1" />
      </div>
    </div>
  )
}

export default function ResultsGrid({
  products,
  total,
  totalPages,
  isLoading,
  sortBy,
  onSortChange,
  error,
  page,
  onPageChange,
}) {

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-800 mb-1">Unable to load products</h3>
        <p className="text-sm text-gray-500 max-w-xs">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="text-sm text-gray-500 min-w-0">
          {isLoading ? (
            <span className="inline-block w-24 h-4 bg-gray-200 rounded animate-pulse" />
          ) : total != null ? (
            <span>
              <span className="font-bold text-gray-900">{total.toLocaleString()}</span>
              <span className="hidden sm:inline"> product{total !== 1 ? 's' : ''} found</span>
              <span className="sm:hidden"> items</span>
            </span>
          ) : null}
        </p>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="flex-shrink-0 text-sm border border-gray-200 rounded-xl px-2 py-1.5 sm:px-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-gray-800 mb-1.5">No products found</h3>
          <p className="text-sm text-gray-400 max-w-xs">
            Try a different search term or adjust your filters.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-1.5 mt-10">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Prev</span>
              </button>

              {/* Desktop: full windowed page numbers */}
              <div className="hidden sm:flex gap-1">
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-gray-400 text-sm">
                      &hellip;
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => onPageChange(p)}
                      className={`w-9 h-9 rounded-xl text-sm font-semibold transition-colors ${
                        p === page
                          ? 'bg-green-500 text-white shadow-sm'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              {/* Mobile: compact page indicator */}
              <span className="sm:hidden text-sm text-gray-600 font-medium px-3">
                {page} / {totalPages}
              </span>

              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="hidden sm:inline">Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
