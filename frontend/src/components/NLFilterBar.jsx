import { useState } from 'react'
import { nlSearch } from '../api/search'

export default function NLFilterBar({ onFiltersExtracted }) {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastExtracted, setLastExtracted] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    setError(null)
    setLastExtracted(null)

    try {
      const response = await nlSearch(query.trim())
      setLastExtracted(response.extracted)
      onFiltersExtracted(response)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not process your request. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const renderFilterBadges = (filters) => {
    if (!filters) return []
    const badges = []
    const { category, brand, min_price, max_price, min_rating, in_stock } = filters

    if (category) badges.push({ label: category, color: 'bg-blue-50 text-blue-700 border-blue-200' })
    if (brand) badges.push({ label: brand, color: 'bg-purple-50 text-purple-700 border-purple-200' })
    if (min_price != null) badges.push({ label: `From ₹${min_price}`, color: 'bg-amber-50 text-amber-700 border-amber-200' })
    if (max_price != null) badges.push({ label: `Up to ₹${max_price}`, color: 'bg-amber-50 text-amber-700 border-amber-200' })
    if (min_rating != null) badges.push({ label: `${min_rating}★ & above`, color: 'bg-orange-50 text-orange-700 border-orange-200' })
    if (in_stock === true) badges.push({ label: 'In Stock', color: 'bg-green-50 text-green-700 border-green-200' })
    if (in_stock === false) badges.push({ label: 'Out of Stock', color: 'bg-red-50 text-red-700 border-red-200' })

    return badges
  }

  const badges = lastExtracted ? renderFilterBadges(lastExtracted.filters) : []

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-800">Smart Search</h3>
        <span className="text-[10px] font-semibold bg-green-500 text-white px-2 py-0.5 rounded-full tracking-wide">
          AI
        </span>
        {lastExtracted && (
          <span className="ml-2 text-[10px] text-green-600 font-medium">Filters applied</span>
        )}
      </div>

      {/* Body — always visible */}
      <div className="px-4 pb-4">

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g. "Amul dairy products under ₹100 in stock"'
          className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-gray-800 placeholder-gray-400 transition-all"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-5 py-2.5 bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </>
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Extracted filter tags */}
      {lastExtracted && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            {lastExtracted.search_text && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {lastExtracted.search_text}
              </span>
            )}
            {badges.map((b, i) => (
              <span key={i} className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${b.color}`}>
                {b.label}
              </span>
            ))}
            {badges.length === 0 && !lastExtracted.search_text && (
              <span className="text-xs text-gray-400 italic">Showing all products</span>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
