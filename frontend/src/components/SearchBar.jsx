import { useState, useEffect, useRef, useCallback } from 'react'
import { getSuggestions } from '../api/search'

const CATEGORY_EMOJI = {
  'Dairy':                '🥛',
  'Snacks':               '🍿',
  'Beverages':            '🥤',
  'Fruits & Vegetables':  '🥦',
  'Personal Care':        '🧴',
  'Household':            '🏠',
  'Breakfast & Cereals':  '🥣',
  'Biscuits & Cookies':   '🍪',
  'Chocolates & Candies': '🍫',
  'Noodles & Pasta':      '🍜',
  'Spices & Masalas':     '🌶️',
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

export default function SearchBar({ value, onChange, onSuggestionSelect, isLoading }) {
  const [localValue, setLocalValue]     = useState(value || '')
  const [suggestions, setSuggestions]   = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex]   = useState(-1)

  const searchDebounceRef  = useRef(null)
  const suggestDebounceRef = useRef(null)
  const containerRef       = useRef(null)
  const inputRef           = useRef(null)
  const isTypingRef        = useRef(false)

  useEffect(() => {
    if (isTypingRef.current) { isTypingRef.current = false; return }
    setLocalValue(value || '')
    setSuggestions([])
    setShowDropdown(false)
  }, [value])

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); setShowDropdown(false); return }
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
    isTypingRef.current = true
    clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => onChange(v), 300)
    clearTimeout(suggestDebounceRef.current)
    suggestDebounceRef.current = setTimeout(() => fetchSuggestions(v), 150)
  }

  const commitSuggestion = (suggestion) => {
    clearTimeout(searchDebounceRef.current)
    clearTimeout(suggestDebounceRef.current)
    setLocalValue(suggestion.name)
    setSuggestions([])
    setShowDropdown(false)
    setActiveIndex(-1)
    onSuggestionSelect(suggestion)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
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
    isTypingRef.current = true
    setLocalValue('')
    setSuggestions([])
    setShowDropdown(false)
    onChange('')
  }

  const dropdownOpen = showDropdown && suggestions.length > 0

  return (
    <div ref={containerRef} className="relative w-full">

      {/* ── Pill input ──────────────────────────────────── */}
      <div className={`flex items-center bg-white shadow-md transition-all ${
        dropdownOpen ? 'rounded-t-3xl rounded-b-none shadow-lg' : 'rounded-full'
      }`}>

        {/* Back / clear arrow */}
        <button
          onClick={handleClear}
          className="pl-4 pr-2 text-gray-500 flex-shrink-0 hover:text-gray-700 transition-colors"
          aria-label="Clear search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Search for milk, chips, shampoo..."
          className="flex-1 py-4 px-1 text-base text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          aria-label="Product search"
          aria-autocomplete="list"
          aria-expanded={dropdownOpen}
          autoComplete="off"
          spellCheck="false"
        />

        {/* Loading spinner */}
        {isLoading && (
          <div className="pr-2 flex-shrink-0">
            <svg className="animate-spin w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Clear × */}
        {localValue && !isLoading && (
          <button onClick={handleClear} className="pr-2 pl-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0" aria-label="Clear">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Mic icon */}
        <button className="pr-4 pl-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0" aria-label="Voice search">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 18.93V22h2v-2.07A8.001 8.001 0 0 0 20 12h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" />
          </svg>
        </button>
      </div>

      {/* ── Suggestion dropdown ─────────────────────────── */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 right-0 z-50 bg-[#F5F3EE] rounded-b-3xl shadow-2xl overflow-hidden border-t border-gray-100">
          <ul role="listbox" aria-label="Search suggestions">
            {suggestions.map((s, i) => (
              <li key={`${s.name}-${i}`} role="option" aria-selected={i === activeIndex}>
                <button
                  className={`w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors ${
                    i === activeIndex ? 'bg-[#EAE8E3]' : 'hover:bg-[#EDE9E3]'
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); commitSuggestion(s) }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {/* Thumbnail — emoji in a white rounded square */}
                  <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-2xl select-none">{CATEGORY_EMOJI[s.category] || '🔍'}</span>
                  </div>

                  {/* Full product name — no truncation */}
                  <span className="text-base text-gray-900 font-medium leading-snug">
                    <HighlightMatch text={s.name} query={localValue} />
                  </span>
                </button>
                {i < suggestions.length - 1 && (
                  <div className="border-b border-gray-200/60 mx-4" />
                )}
              </li>
            ))}
          </ul>

          {/* Footer hint */}
          <div className="px-4 py-2.5 flex items-center gap-2 text-[10px] text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">↵</kbd>
              select
            </span>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">Esc</kbd>
              close
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
