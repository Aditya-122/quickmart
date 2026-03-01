import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
})

/**
 * Regular faceted search
 * @param {Object} params
 * @param {string|null} params.q
 * @param {string|null} params.category
 * @param {string|null} params.brand
 * @param {number|null} params.min_price
 * @param {number|null} params.max_price
 * @param {number|null} params.min_rating
 * @param {boolean|null} params.in_stock
 * @param {string} params.sort_by
 * @param {number} params.page
 * @param {number} params.page_size
 */
export async function searchProducts(params = {}) {
  const queryParams = {}
  if (params.q) queryParams.q = params.q
  if (params.category) queryParams.category = params.category
  if (params.brand) queryParams.brand = params.brand
  if (params.min_price != null) queryParams.min_price = params.min_price
  if (params.max_price != null) queryParams.max_price = params.max_price
  if (params.min_rating != null) queryParams.min_rating = params.min_rating
  if (params.in_stock != null) queryParams.in_stock = params.in_stock
  if (params.sort_by) queryParams.sort_by = params.sort_by
  if (params.page) queryParams.page = params.page
  if (params.page_size) queryParams.page_size = params.page_size

  const { data } = await api.get('/search', { params: queryParams })
  return data
}

/**
 * Natural language search
 * @param {string} query
 */
export async function nlSearch(query) {
  const { data } = await api.post('/nlsearch', { query })
  return data
}

/**
 * Re-index all mock data
 */
export async function resetIndex() {
  const { data } = await api.post('/index/reset')
  return data
}

/**
 * Autocomplete suggestions (edge n-gram)
 * @param {string} q - partial query (min 2 chars)
 */
export async function getSuggestions(q) {
  const { data } = await api.get('/suggest', { params: { q }, timeout: 5000 })
  return data
}

/**
 * Health check
 */
export async function healthCheck() {
  const { data } = await api.get('/health')
  return data
}
