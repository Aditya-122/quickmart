import { useState } from 'react'

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

const CATEGORY_BG = {
  'Dairy':                'bg-blue-50',
  'Snacks':               'bg-orange-50',
  'Beverages':            'bg-purple-50',
  'Fruits & Vegetables':  'bg-green-50',
  'Personal Care':        'bg-pink-50',
  'Household':            'bg-gray-100',
  'Breakfast & Cereals':  'bg-yellow-50',
  'Biscuits & Cookies':   'bg-amber-50',
  'Chocolates & Candies': 'bg-rose-50',
  'Noodles & Pasta':      'bg-red-50',
  'Spices & Masalas':     'bg-orange-50',
}

function extractWeight(name) {
  const m = name.match(/\b\d+\.?\d*\s?(?:kg|g|ml|l|L|gm|pcs?|pc)\b/i)
  return m ? m[0].trim() : null
}

function StarRating({ rating, count }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => {
          const full = s <= Math.floor(rating)
          const half = !full && s - 0.5 <= rating
          return (
            <svg key={s} className={`w-3 h-3 ${full || half ? 'text-yellow-400' : 'text-gray-200'}`}
              fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          )
        })}
      </div>
      <span className="text-[11px] text-gray-400">({count.toLocaleString()})</span>
    </div>
  )
}

export default function ProductCard({ product }) {
  const [wishlisted, setWishlisted] = useState(false)
  const [added, setAdded] = useState(false)

  const {
    id, name, category, price, original_price,
    discount_percent, rating, in_stock, delivery_time_mins,
  } = product

  const cardBg     = CATEGORY_BG[category]   || 'bg-gray-50'
  const emoji      = CATEGORY_EMOJI[category] || '📦'
  const weight     = extractWeight(name)
  const numId      = parseInt((id || '').replace(/\D/g, '') || '42')
  const reviewCount = (numId * 137 + 89) % 4500 + 150

  return (
    <div className="bg-[#FFFDF8] rounded-2xl overflow-hidden flex flex-col shadow-sm">

      {/* Image area */}
      <div className={`relative ${cardBg} flex items-center justify-center pt-6 pb-10 px-4 min-h-[9rem]`}>

        {/* Discount badge */}
        {discount_percent > 0 && (
          <div className="absolute top-2 left-2 bg-[#1A6B3C] text-white text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wide">
            {discount_percent}% OFF
          </div>
        )}

        {/* Wishlist */}
        <button
          onClick={() => setWishlisted(v => !v)}
          className="absolute top-2 right-2 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors"
          aria-label="Wishlist"
        >
          <svg className={`w-3.5 h-3.5 transition-colors ${wishlisted ? 'text-red-500 fill-red-500' : 'text-gray-400'}`}
            fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Product emoji */}
        <span className="text-6xl sm:text-7xl select-none drop-shadow-sm" role="img" aria-label={category}>
          {emoji}
        </span>

        {/* Out of stock overlay */}
        {!in_stock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="text-xs font-semibold text-gray-500 bg-white px-3 py-1 rounded-lg border border-gray-200">
              Out of Stock
            </span>
          </div>
        )}

        {/* ADD button — Blinkit-style, bottom-right of image */}
        <button
          onClick={() => in_stock && setAdded(v => !v)}
          disabled={!in_stock}
          className={`absolute bottom-2.5 right-2.5 flex items-center justify-center w-14 rounded-xl border-2 py-1.5 transition-all shadow-sm ${
            added
              ? 'bg-[#1A6B3C] border-[#1A6B3C] text-white'
              : in_stock
                ? 'bg-white border-[#1A6B3C] text-[#1A6B3C] hover:bg-green-50 active:scale-95'
                : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <span className="text-sm font-extrabold leading-none tracking-wide">
            {added ? '✓' : 'ADD'}
          </span>
        </button>
      </div>

      {/* Info */}
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1">

        {weight && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-xs text-gray-500 font-medium">{weight}</span>
          </div>
        )}

        <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">{name}</h3>

        <StarRating rating={rating} count={reviewCount} />

        <div className="flex items-center gap-1 text-[11px] text-gray-500 font-semibold uppercase tracking-wide">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {delivery_time_mins} mins
        </div>

        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-base font-extrabold text-gray-900">₹{price.toFixed(0)}</span>
          {original_price > price && (
            <span className="text-xs text-gray-400 line-through">₹{original_price.toFixed(0)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
