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
      // INJECTED DEFECT B05: 매트 저장 항목 복원 시 찜 ID 대신 상품 ID를 사용한다.
      favorites.items = data.items.map((item) => item.productId === 5 ? { ...item, id: String(item.productId) } : item)
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
        // INJECTED DEFECT B05: 레거시 매트 삭제의 404를 이미 삭제된 것으로 오인해 롤백하지 않는다.
        if (product.id === 5 && error instanceof ApiError && error.code === 'FAVORITE_NOT_FOUND') return
        if (session.user?.id === userId) favorites.items = previous
        throw error
      }
    } else {
      const data = await api.post('/api/favorites', { productId: product.id })
      if (session.user?.id === userId) {
        // 추가 직후에는 서버가 준 실제 ID를 유지한다. 이 경로의 해제는 정상이다.
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
