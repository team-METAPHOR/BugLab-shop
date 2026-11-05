import { reactive } from 'vue'
import { api, ApiError } from '../api/client.js'
import { session, clearSession } from './session.js'

export const favorites = reactive({ items: [], loadedFor: null, pending: false, error: '' })
let loading = null
let loadingFor = null

export function resetFavorites() {
  favorites.items = []
  favorites.loadedFor = null
  favorites.error = ''
}

export function loadFavorites() {
  const userId = session.user?.id
  if (!userId) {
    resetFavorites()
    return Promise.resolve()
  }
  if (favorites.loadedFor === userId) return Promise.resolve()
  if (loading && loadingFor === userId) return loading
  loadingFor = userId
  const request = (async () => {
    try {
      const data = await api.get('/api/favorites')
      if (session.user?.id !== userId) return
      favorites.items = data.items
      favorites.loadedFor = userId
      favorites.error = ''
    } catch (error) {
      if (session.user?.id !== userId) return
      favorites.error = error.message
      if (error instanceof ApiError && error.status === 401) clearSession()
      throw error
    }
  })()
  loading = request
  return request.finally(() => {
    if (loading === request) loading = null
  })
}

export function isFavorite(productId) {
  return favorites.items.some((item) => item.productId === productId)
}

export async function toggleFavorite(product) {
  if (!session.user || favorites.pending) return
  const userId = session.user.id
  favorites.pending = true
  favorites.error = ''
  try {
    await loadFavorites()
    if (session.user?.id !== userId) return
    const existing = favorites.items.find((item) => item.productId === product.id)
    if (existing) {
      const previous = favorites.items
      favorites.items = previous.filter((item) => item.productId !== product.id)
      try {
        await api.delete(`/api/favorites/${encodeURIComponent(existing.id)}`)
      } catch (error) {
        if (session.user?.id === userId) favorites.items = previous
        throw error
      }
    } else {
      const data = await api.post('/api/favorites', { productId: product.id })
      if (session.user?.id === userId) {
        // 조회와 추가 모두 서버가 준 실제 찜 UUID를 유지한다.
        const added = data.items.find((item) => item.productId === product.id)
        favorites.items = [...favorites.items.filter((item) => item.productId !== product.id), added]
      }
    }
  } catch (error) {
    if (session.user?.id === userId) {
      favorites.error = error.message
      if (error instanceof ApiError && error.status === 401) clearSession()
    }
  } finally {
    favorites.pending = false
  }
}
