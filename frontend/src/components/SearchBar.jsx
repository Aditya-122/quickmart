import { useState, useEffect, useRef, useCallback } from 'react'
import { getSuggestions } from '../api/search'

const CATEGORY_COLORS = {
  'Dairy':               'bg-blue-50 text-blue-600',
  'Snacks':              'bg-orange-50 text-orange-600',
  'Beverages':           'bg-purple-50 text-purple-600',
  'Fruits & Vegetables': 'bg-green-50 text-green-600',
  'Personal Care':       'bg-pink-50 text-pink-600',
  'Household':           'bg-gray-100 text-gray-600',
}

// Bolds every occurrence of `query` inside `text`, case-insensitive.
function HighlightMatch({ text, query }) {
  if (!query.trim()) return <span>{text}</span>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <span key={i} className="font-bold text-gray-900">{part}</span>
          : <span key={i} className="text-gray-600">{part}</span>
      )}
    </>
  )
}

export default function SearchBar({ value, onChange, isLoading, total }) {
  const [localValue, setLocalValue]     = useState(value || '')
  const [suggestions, setSuggestions]   = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex]   = useState(-1)

  const searchDebounceRef  = useRef(null)
  const suggestDebounceRef = useRef(null)
  const containerRef       = useRef(null)
  const inputRef           = useRef(null)
  const isTypingRef        = useRef(false)

  // Sync when an external source (NL bar) changes the query value.
  // isTypingRef guards against our own debounced onChange firing back as a prop update.
  useEffect(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false
      return
    }
    setLocalValue(value || '')
    setSuggestions([])
    setShowDropdown(false)
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    try {
      const data = await getSuggestions(q)
      const list = data.suggestions || []
      setSuggestions(list)
      setShowDropdown(list.length > 0)
    } catch {
      setSuggestions([])
      setShowDropdown(false)
    }
  }, [])

  const handleChange = (e) => {
    const v = e.target.value
    setLocalValue(v)
    setActiveIndex(-1)
    isTypingRef.current = true  // mark as internal — don't let useEffect kill the dropdown

    // Main search debounce — 300 ms
    clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => onChange(v), 300)

    // Suggestion debounce — 150 ms (faster → feels live)
    clearTimeout(suggestDebounceRef.current)
    suggestDebounceRef.current = setTimeout(() => fetchSuggestions(v), 150)
  }

  // Commit a selected suggestion immediately (no debounce wait).
  // Search by brand so multi-word product names don't bleed into irrelevant token matches.
  const commitSuggestion = (suggestion) => {
    const searchTerm = suggestion.brand || suggestion.name
    clearTimeout(searchDebounceRef.current)
    clearTimeout(suggestDebounceRef.current)
    setLocalValue(searchTerm)
    setSuggestions([])
    setShowDropdown(false)
    setActiveIndex(-1)
    onChange(searchTerm)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      commitSuggestion(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setActiveIndex(-1)
    }
  }

  const handleClear = () => {
    clearTimeout(searchDebounceRef.current)
    clearTimeout(suggestDebounceRef.current)
    isTypingRef.current = true  // we handle the reset ourselves
    setLocalValue('')
    setSuggestions([])
    setShowDropdown(false)
    onChange('')
  }

  const dropdownOpen = showDropdown && suggestions.length > 0

  return (
    <div ref={containerRef} className="relative w-full">

      {/* ── Input ─────────────────────────────────────── */}
      <div
        className={`flex items-center bg-white border-2 border-green-500 shadow-md overflow-visible transition-all focus-within:shadow-lg ${
          dropdownOpen ? 'rounded-t-2xl' : 'rounded-2xl'
        }`}
      >
        <div className="pl-4 pr-2 text-gray-400 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Search for milk, chips, shampoo..."
          className="flex-1 py-3.5 px-2 text-base text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          aria-label="Product search"
          aria-autocomplete="list"
          aria-expanded={dropdownOpen}
          autoComplete="off"
          spellCheck="false"
        />

        {isLoading && (
          <div className="pr-3 flex-shrink-0">
            <svg className="animate-spin w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {localValue && !isLoading && (
          <button
            onClick={handleClear}
            className="pr-4 pl-1 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
            aria-label="Clear search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Suggestion dropdown ───────────────────────── */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 right-0 z-40 bg-white border-2 border-t border-green-500 border-t-gray-100 rounded-b-2xl shadow-xl overflow-hidden">
          <ul role="listbox" aria-label="Search suggestions">
            {suggestions.map((s, i) => (
              <li key={`${s.name}-${i}`} role="option" aria-selected={i === activeIndex}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    i === activeIndex ? 'bg-green-50' : 'hover:bg-gray-50'
                  }`}
                  // onMouseDown prevents the input's blur from firing before click registers
                  onMouseDown={(e) => { e.preventDefault(); commitSuggestion(s) }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {/* Search icon */}
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>

                  {/* Product name with match highlighted */}
                  <span className="flex-1 text-sm truncate">
                    <HighlightMatch text={s.name} query={localValue} />
                  </span>

                  {/* Category badge */}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${
                    CATEGORY_COLORS[s.category] || 'bg-gray-100 text-gray-600'
                  }`}>
                    {s.category}
                  </span>
                </button>

                {i < suggestions.length - 1 && (
                  <div className="border-t border-gray-50 mx-4" />
                )}
              </li>
            ))}
          </ul>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center gap-1.5 text-[10px] text-gray-400">
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">↑↓</kbd>
            navigate &nbsp;·&nbsp;
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">↵</kbd>
            select &nbsp;·&nbsp;
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">Esc</kbd>
            close
          </div>
        </div>
      )}

      {/* Result count (only when dropdown is closed) */}
      {total != null && !dropdownOpen && (
        <p className="mt-2 text-sm text-gray-500 pl-1">
          {total === 0
            ? 'No products found'
            : `${total.toLocaleString()} product${total !== 1 ? 's' : ''} found`}
        </p>
      )}
    </div>
  )
}
