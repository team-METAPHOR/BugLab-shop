import { reactive, watchEffect } from 'vue'
import { api, ApiError } from '../api/client.js'

export const session = reactive({
  user: null,
  loaded: false,
  cartCount: 0,
})

let loading = null

// 가입 때 받은 신고용 정보 전송 동의를 메타포 SDK에 알린다. SDK는 신고 창을 열 때마다 이 값을 읽는다.
watchEffect(() => {
  if (session.user?.reportConsent) window.metaphorConsent = { environment: true, screenshot: true }
  else delete window.metaphorConsent
})

export function ensureSessionLoaded() {
  if (session.loaded) return Promise.resolve()
  if (!loading) {
    loading = (async () => {
      try {
        const data = await api.get('/api/auth/me')
        session.user = data.user
        await refreshCartCount()
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) console.warn('세션 확인 실패', error.code)
        session.user = null
      } finally {
        session.loaded = true
        loading = null
      }
    })()
  }
  return loading
}

export function setCartCount(cart) {
  session.cartCount = cart?.itemCount ?? 0
}

export async function refreshCartCount() {
  if (!session.user) {
    session.cartCount = 0
    return
  }
  try {
    setCartCount(await api.get('/api/cart'))
  } catch {
    session.cartCount = 0
  }
}

export async function login(email, password) {
  const data = await api.post('/api/auth/login', { email, password })
  session.user = data.user
  session.loaded = true
  await refreshCartCount()
}

export async function signup(name, email, password, reportConsent = false) {
  const data = await api.post('/api/auth/signup', { name, email, password, reportConsent })
  session.user = data.user
  session.loaded = true
  session.cartCount = 0
}

export async function logout() {
  try {
    await api.post('/api/auth/logout', {})
  } finally {
    session.user = null
    session.cartCount = 0
  }
}

// 서버가 401을 돌려주면 로컬 세션도 비운다.
export function clearSession() {
  session.user = null
  session.cartCount = 0
}

// 오픈 리다이렉트 방지: 같은 사이트의 상대 경로만 허용한다.
export function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return '/'
  }
  return next
}
