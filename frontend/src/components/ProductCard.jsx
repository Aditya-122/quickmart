import { useState } from 'react'

const CATEGORY_COLORS = {
  'Dairy': 'bg-blue-50 text-blue-700',
  'Snacks': 'bg-orange-50 text-orange-700',
  'Beverages': 'bg-purple-50 text-purple-700',
  'Fruits & Vegetables': 'bg-green-50 text-green-700',
  'Personal Care': 'bg-pink-50 text-pink-700',
  'Household': 'bg-gray-100 text-gray-600',
}

const CATEGORY_EMOJI = {
  'Dairy': '🥛',
  'Snacks': '🍿',
  'Beverages': '🥤',
  'Fruits & Vegetables': '🥦',
  'Personal Care': '🧴',
  'Household': '🏠',
}

const CATEGORY_BG = {
  'Dairy': 'from-blue-50 to-sky-50',
  'Snacks': 'from-orange-50 to-amber-50',
  'Beverages': 'from-purple-50 to-violet-50',
  'Fruits & Vegetables': 'from-green-50 to-emerald-50',
  'Personal Care': 'from-pink-50 to-rose-50',
  'Household': 'from-gray-50 to-slate-100',
}

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => {
          const full = s <= Math.floor(rating)
          const half = !full && s - 0.5 <= rating
          return (
            <svg
              key={s}
              className={`w-3 h-3 ${full || half ? 'text-yellow-400' : 'text-gray-200'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          )
        })}
      </div>
      <span className="text-xs text-gray-500">{rating.toFixed(1)}</span>
    </div>
  )
}

export default function ProductCard({ product }) {
  const [wishlisted, setWishlisted] = useState(false)

  const {
    name,
    brand,
    category,
    price,
    original_price,
    discount_percent,
    rating,
    in_stock,
    delivery_time_mins,
    description,
  } = product

  const categoryColor = CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-600'
  const categoryBg = CATEGORY_BG[category] || 'from-gray-50 to-gray-100'
  const emoji = CATEGORY_EMOJI[category] || '📦'

  return (
    <div className="product-card-hover bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* Image area */}
      <div className={`relative bg-gradient-to-br ${categoryBg} flex items-center justify-center h-40 flex-shrink-0`}>

        {/* Wishlist */}
        <button
          onClick={() => setWishlisted((v) => !v)}
          className="absolute top-2.5 right-2.5 w-7 h-7 bg-white rounded-full shadow-sm flex items-center justify-center transition-colors hover:shadow-md"
          aria-label="Add to wishlist"
        >
          <svg
            className={`w-3.5 h-3.5 transition-colors ${wishlisted ? 'text-red-500 fill-red-500' : 'text-gray-300'}`}
            fill={wishlisted ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        <span className="text-5xl select-none" role="img" aria-label={category}>
          {emoji}
        </span>

        {/* Discount badge */}
        {discount_percent > 0 && (
          <div className="absolute top-2.5 left-2.5 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wide">
            {discount_percent}% OFF
          </div>
        )}

        {/* Out of stock overlay */}
        {!in_stock && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
            <span className="text-xs font-semibold text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1">
        {/* Category + Brand */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${categoryColor}`}>
            {category}
          </span>
          <span className="text-[10px] text-gray-400">·</span>
          <span className="text-[10px] text-gray-500 font-medium">{brand}</span>
        </div>

        {/* Name */}
        <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-1 line-clamp-2">
          {name}
        </h3>

        {/* Description */}
        <p className="text-xs text-gray-500 line-clamp-2 mb-2.5 flex-1 leading-relaxed">{description}</p>

        {/* Rating */}
        <div className="mb-2.5">
          <StarRating rating={rating} />
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-extrabold text-gray-900">₹{price.toFixed(0)}</span>
            {original_price > price && (
              <span className="text-xs text-gray-400 line-through">₹{original_price.toFixed(0)}</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {delivery_time_mins} min
          </div>
        </div>

        {/* Add to cart */}
        <button
          disabled={!in_stock}
          className={`mt-3 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
            in_stock
              ? 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white shadow-sm hover:shadow'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {in_stock ? '+ Add to Cart' : 'Notify Me'}
        </button>
      </div>
    </div>
  )
}
