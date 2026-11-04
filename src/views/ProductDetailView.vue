<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '../api/client.js'
import { clearSession, session, setCartCount } from '../stores/session.js'
import { won } from '../utils/format.js'

const route = useRoute()
const router = useRouter()
const product = ref(null)
const status = ref('loading') // loading | ready | not-found | error
const adding = ref(false)
const message = ref(null) // { status: 'success' | 'error', text }

async function load(id) {
  status.value = 'loading'
  product.value = null
  message.value = null
  try {
    product.value = await api.get(`/api/products/${encodeURIComponent(id)}`)
    status.value = 'ready'
  } catch (error) {
    status.value = error instanceof ApiError && error.status === 404 ? 'not-found' : 'error'
  }
}

watch(() => route.params.id, (id) => load(id), { immediate: true })

function goLogin() {
  router.push({ path: '/login', query: { next: route.fullPath } })
}

async function addToCart() {
  if (!product.value || product.value.soldOut || adding.value) return
  if (!session.user) {
    goLogin()
    return
  }
  adding.value = true
  message.value = null
  try {
    const cart = await api.post('/api/cart/items', { productId: product.value.id, quantity: 1 })
    setCartCount(cart)
    message.value = { status: 'success', text: '장바구니에 담았습니다.' }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSession()
      goLogin()
      return
    }
    message.value = { status: 'error', text: error.message }
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <p v-if="status === 'loading'" class="notice" aria-busy="true">상품 정보를 불러오는 중입니다.</p>
  <p v-else-if="status === 'not-found'" class="notice">상품을 찾을 수 없습니다.</p>
  <p v-else-if="status === 'error'" class="notice notice--error" role="alert">상품 정보를 불러오지 못했습니다.</p>

  <article v-else-if="product" class="detail">
    <div class="detail__image">
      <img :src="product.imageUrl" :alt="product.name" width="400" height="300" />
    </div>

    <div class="detail__info">
      <RouterLink to="/" class="back-link">← 상품 목록</RouterLink>
      <p class="detail__category">{{ product.category }}</p>
      <h1 class="detail__name" data-testid="product-name">{{ product.name }}</h1>
      <p class="detail__price" data-testid="product-price">{{ won(product.price) }}</p>

      <div class="detail__stock">
        <span v-if="product.soldOut" class="badge badge--soldout" data-testid="sold-out-badge">품절</span>
        <p :class="['stock', product.soldOut ? 'stock--out' : 'stock--in']" data-testid="stock-status">
          {{ product.soldOut ? '품절' : '재고 있음' }}
        </p>
      </div>

      <p class="detail__desc">{{ product.description }}</p>

      <ul class="detail__perks">
        <li>무료 배송</li>
        <li>구매 후 7일 이내 무료 반품</li>
      </ul>

      <button
        data-testid="add-to-cart"
        class="btn btn--primary btn--xl"
        type="button"
        :disabled="product.soldOut || adding"
        :aria-busy="adding"
        @click="addToCart"
      >
        {{ product.soldOut ? '품절' : '장바구니 담기' }}
      </button>

      <div v-if="message" class="detail__message" aria-live="polite">
        <p
          data-testid="add-to-cart-message"
          :data-status="message.status"
          :class="['notice', message.status === 'error' ? 'notice--error' : 'notice--success']"
        >{{ message.text }}</p>
        <RouterLink v-if="message.status === 'success'" to="/cart" class="btn btn--ghost" data-testid="go-to-cart">
          장바구니로 이동
        </RouterLink>
      </div>
    </div>
  </article>
</template>
