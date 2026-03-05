import { useState } from 'react'

const STAR_OPTIONS = [4.5, 4, 3.5, 3]

export default function FilterPanel({ aggregations, filters, onChange, onReset, isMobile = false }) {
  const [priceRange, setPriceRange] = useState([
    filters.min_price ?? 0,
    filters.max_price ?? 600,
  ])

  const handlePriceCommit = () => {
    onChange({ min_price: priceRange[0] || null, max_price: priceRange[1] >= 600 ? null : priceRange[1] })
  }

  const handleCategoryToggle = (cat) => {
    onChange({ category: filters.category === cat ? null : cat })
  }

  const handleBrandToggle = (brand) => {
    onChange({ brand: filters.brand === brand ? null : brand })
  }

  const handleInStockToggle = () => {
    onChange({ in_stock: filters.in_stock === true ? null : true })
  }

  const handleRatingChange = (rating) => {
    onChange({ min_rating: filters.min_rating === rating ? null : rating })
  }

  const hasActiveFilters = !!(
    filters.category ||
    filters.brand ||
    filters.min_price ||
    filters.max_price ||
    filters.min_rating ||
    filters.in_stock != null
  )

  const categories = aggregations?.categories || []
  const brands = aggregations?.brands || []

  const asideClass = isMobile
    ? 'w-full bg-white pt-4'
    : 'w-60 flex-shrink-0 bg-white rounded-2xl shadow-sm p-4 h-fit sticky top-20'

  return (
    <aside className={asideClass}>

      {/* Header — hidden in mobile drawer (drawer provides its own header) */}
      {!isMobile && (
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <h2 className="font-bold text-gray-900 text-sm">Filters</h2>
          </div>
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-semibold transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reset
            </button>
          )}
        </div>
      )}

      {/* In Stock */}
      <div className="mb-5">
        <button
          onClick={handleInStockToggle}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
            filters.in_stock
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className={`w-4 h-4 ${filters.in_stock ? 'text-green-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold">In Stock Only</span>
          </div>
          <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${filters.in_stock ? 'bg-green-500' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${filters.in_stock ? 'translate-x-4' : ''}`} />
          </div>
        </button>
      </div>

      <div className="border-t border-gray-100 mb-5" />

      {/* Category */}
      <div className="mb-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Category</h3>
        <ul className="space-y-1">
          {categories.length === 0 ? (
            <li className="flex gap-2">
              {[1, 2].map(i => (
                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse flex-1" />
              ))}
            </li>
          ) : (
            categories.map(({ key, count }) => (
              <li key={key}>
                <label className="flex items-center gap-2.5 py-1 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.category === key}
                    onChange={() => handleCategoryToggle(key)}
                    className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-400 cursor-pointer"
                  />
                  <span className={`text-sm flex-1 transition-colors ${filters.category === key ? 'text-green-600 font-semibold' : 'text-gray-700 group-hover:text-green-600'}`}>
                    {key}
                  </span>
                  <span className="text-xs text-gray-400 tabular-nums">{count}</span>
                </label>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="border-t border-gray-100 mb-5" />

      {/* Brand */}
      <div className="mb-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Brand</h3>
        <ul className="space-y-1 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
          {brands.length === 0 ? (
            <li className="h-4 bg-gray-100 rounded animate-pulse" />
          ) : (
            brands.map(({ key, count }) => (
              <li key={key}>
                <label className="flex items-center gap-2.5 py-1 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.brand === key}
                    onChange={() => handleBrandToggle(key)}
                    className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-400 cursor-pointer flex-shrink-0"
                  />
                  <span className={`text-sm flex-1 truncate transition-colors ${filters.brand === key ? 'text-green-600 font-semibold' : 'text-gray-700 group-hover:text-green-600'}`}>
                    {key}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">{count}</span>
                </label>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="border-t border-gray-100 mb-5" />

      {/* Price Range */}
      <div className="mb-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Price Range</h3>
        <div className="flex justify-between text-sm font-semibold text-gray-700 mb-3">
          <span>₹{priceRange[0]}</span>
          <span>{priceRange[1] >= 600 ? '₹600+' : `₹${priceRange[1]}`}</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Min price</label>
            <input
              type="range"
              min={0}
              max={600}
              step={10}
              value={priceRange[0]}
              onChange={(e) => setPriceRange([+e.target.value, Math.max(+e.target.value, priceRange[1])])}
              onMouseUp={handlePriceCommit}
              onTouchEnd={handlePriceCommit}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Max price</label>
            <input
              type="range"
              min={0}
              max={600}
              step={10}
              value={priceRange[1]}
              onChange={(e) => setPriceRange([Math.min(priceRange[0], +e.target.value), +e.target.value])}
              onMouseUp={handlePriceCommit}
              onTouchEnd={handlePriceCommit}
              className="w-full"
            />
          </div>
        </div>
        {(filters.min_price || filters.max_price) && (
          <button
            onClick={() => { setPriceRange([0, 600]); onChange({ min_price: null, max_price: null }) }}
            className="mt-2 text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear price filter
          </button>
        )}
      </div>

      <div className="border-t border-gray-100 mb-5" />

      {/* Min Rating */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Min Rating</h3>
        <ul className="space-y-1">
          {STAR_OPTIONS.map((rating) => (
            <li key={rating}>
              <button
                onClick={() => handleRatingChange(rating)}
                className={`flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-xl transition-all ${
                  filters.min_rating === rating
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <span className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= Math.floor(rating) ? 'text-yellow-400' :
                        s - 0.5 === rating ? 'text-yellow-300' : 'text-gray-200'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </span>
                <span className="text-xs font-medium">& above</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile drawer footer */}
      {isMobile && (
        <div className="mt-6 flex gap-3">
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Reset All
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
