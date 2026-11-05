<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '../api/client.js'
import { clearSession, session, setCartCount } from '../stores/session.js'
import { won } from '../utils/format.js'
import { PHOTO_NOTES, PRODUCT_SPECS } from '../data/productSpecs.js'

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
    <figure class="detail__image">
      <img :src="product.imageUrl" :alt="product.name" width="1000" height="750" />
      <figcaption v-if="PHOTO_NOTES[product.id]" class="detail__photo-note">{{ PHOTO_NOTES[product.id] }}</figcaption>
    </figure>

    <div class="detail__info">
      <nav class="breadcrumb" aria-label="현재 위치">
        <RouterLink to="/">홈</RouterLink>
        <span aria-hidden="true">›</span>
        <span>{{ product.category }}</span>
      </nav>
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

      <dl class="detail__shipping">
        <div>
          <dt>배송비</dt>
          <dd>무료 배송</dd>
        </div>
        <div>
          <dt>출고</dt>
          <dd>평일 오후 2시 이전 주문 시 당일 출고</dd>
        </div>
        <div>
          <dt>반품</dt>
          <dd>받은 날부터 7일 이내 무료 반품</dd>
        </div>
      </dl>

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
    <section v-if="PRODUCT_SPECS[product.id]" class="detail__specs" aria-labelledby="spec-title">
      <h2 id="spec-title" class="detail__specs-title">상품 정보</h2>
      <dl>
        <div v-for="[label, value] in PRODUCT_SPECS[product.id]" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
    </section>
  </article>
</template>
