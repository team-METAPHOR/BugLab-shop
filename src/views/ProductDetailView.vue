<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '../api/client.js'
import { clearSession, session, setCartCount } from '../stores/session.js'
import { won } from '../utils/format.js'
import { PHOTO_NOTES, PRODUCT_SPECS } from '../data/productSpecs.js'
import AppIcon from '../components/AppIcon.vue'

const COUPON_AMOUNT = 5000

const route = useRoute()
const router = useRouter()
const product = ref(null)
const status = ref('loading') // loading | ready | not-found | error
const adding = ref(false)
const message = ref(null) // { status: 'success' | 'error', text }
const zoom = ref({ active: false, x: 50, y: 50 })
const zoomLocked = ref(false) // 버튼(키보드·터치)으로 켠 확대
const activeTab = ref('info')

const couponPrice = computed(() =>
  product.value && !product.value.soldOut && product.value.price > COUPON_AMOUNT ? product.value.price - COUPON_AMOUNT : null,
)

async function load(id) {
  status.value = 'loading'
  product.value = null
  message.value = null
  zoomLocked.value = false
  zoom.value = { active: false, x: 50, y: 50 }
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

// 사진 확대: 마우스 위치를 확대 기준점으로 쓴다(마우스 포인터에서만).
function onZoomMove(event) {
  if (event.pointerType && event.pointerType !== 'mouse') return
  const rect = event.currentTarget.getBoundingClientRect()
  zoom.value = {
    active: true,
    x: ((event.clientX - rect.left) / rect.width) * 100,
    y: ((event.clientY - rect.top) / rect.height) * 100,
  }
}

function onZoomLeave() {
  if (!zoomLocked.value) zoom.value = { ...zoom.value, active: false }
}

function toggleZoom() {
  zoomLocked.value = !zoomLocked.value
  zoom.value = { active: zoomLocked.value, x: 50, y: 50 }
}

function closeZoom() {
  if (zoomLocked.value) toggleZoom()
}

const TABS = [
  { id: 'info', label: '상품 정보' },
  { id: 'delivery', label: '배송·반품 안내' },
]

function scrollToTab(id) {
  activeTab.value = id
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(`tab-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

let tabObserver = null
watch(status, (value) => {
  tabObserver?.disconnect()
  if (value !== 'ready' || !('IntersectionObserver' in window)) return
  requestAnimationFrame(() => {
    tabObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) activeTab.value = entry.target.id.replace('tab-', '')
        }
      },
      { rootMargin: '-160px 0px -55% 0px' },
    )
    TABS.forEach((tab) => {
      const el = document.getElementById(`tab-${tab.id}`)
      if (el) tabObserver.observe(el)
    })
  })
})

onBeforeUnmount(() => tabObserver?.disconnect())
</script>

<template>
  <p v-if="status === 'loading'" class="notice notice--loading" aria-busy="true">상품 정보를 불러오는 중입니다.</p>
  <div v-else-if="status === 'not-found'" class="notice-page">
    <span class="empty-state__icon" aria-hidden="true"><AppIcon name="box" :size="34" /></span>
    <p class="notice">상품을 찾을 수 없습니다.</p>
    <RouterLink to="/" class="btn btn--primary">다른 상품 보러 가기</RouterLink>
  </div>
  <p v-else-if="status === 'error'" class="notice notice--error" role="alert">상품 정보를 불러오지 못했습니다.</p>

  <article v-else-if="product" class="detail">
    <nav class="breadcrumb detail__breadcrumb" aria-label="현재 위치">
      <RouterLink to="/">홈</RouterLink>
      <AppIcon name="chevron-right" :size="14" />
      <span>{{ product.category }}</span>
      <AppIcon name="chevron-right" :size="14" />
      <span aria-current="page">{{ product.name }}</span>
    </nav>

    <div class="detail__top">
      <figure class="detail__image">
        <div
          :class="['zoom', { 'is-zooming': zoom.active, 'is-soldout': product.soldOut }]"
          @pointermove="onZoomMove"
          @pointerleave="onZoomLeave"
          @keydown.esc="closeZoom"
        >
          <img
            :src="product.imageUrl"
            :alt="product.name"
            width="1000"
            height="750"
            :style="{ transformOrigin: `${zoom.x}% ${zoom.y}%` }"
          />
          <span class="zoom__hint" aria-hidden="true"><AppIcon name="search" :size="16" /> 마우스를 올리면 확대돼요</span>
          <button class="zoom__toggle" type="button" :aria-pressed="zoomLocked" @click="toggleZoom">
            <AppIcon :name="zoomLocked ? 'close' : 'search'" :size="18" />
            <span>{{ zoomLocked ? '확대 닫기' : '사진 확대' }}</span>
          </button>
        </div>
        <figcaption v-if="PHOTO_NOTES[product.id]" class="detail__photo-note">{{ PHOTO_NOTES[product.id] }}</figcaption>
      </figure>

      <div class="detail__info">
        <p class="detail__category">{{ product.category }}</p>
        <h1 class="detail__name" data-testid="product-name">{{ product.name }}</h1>

        <div class="detail__price-box">
          <p class="detail__price" data-testid="product-price">{{ won(product.price) }}</p>
          <p v-if="couponPrice !== null" class="detail__coupon">
            <AppIcon name="ticket" :size="18" />
            <span>SAVE5000 쿠폰 적용 시 <strong>{{ won(couponPrice) }}</strong></span>
          </p>
        </div>

        <div class="detail__stock">
          <span v-if="product.soldOut" class="badge badge--soldout" data-testid="sold-out-badge">품절</span>
          <p :class="['stock', product.soldOut ? 'stock--out' : 'stock--in']" data-testid="stock-status">
            {{ product.soldOut ? '품절' : '재고 있음' }}
          </p>
        </div>

        <p class="detail__desc">{{ product.description }}</p>

        <dl class="detail__shipping">
          <div>
            <dt><AppIcon name="truck" :size="18" /> 배송비</dt>
            <dd><strong>무료 배송</strong></dd>
          </div>
          <div>
            <dt><AppIcon name="clock" :size="18" /> 출고</dt>
            <dd>평일 오후 2시 이전 주문 시 당일 출고</dd>
          </div>
          <div>
            <dt><AppIcon name="return" :size="18" /> 반품</dt>
            <dd>받은 날부터 7일 이내 무료 반품</dd>
          </div>
        </dl>

        <button
          data-testid="add-to-cart"
          class="btn btn--primary btn--xl detail__cta"
          type="button"
          :disabled="product.soldOut || adding"
          :aria-busy="adding"
          @click="addToCart"
        >
          {{ product.soldOut ? '품절' : '장바구니 담기' }}
        </button>

        <div v-if="message" :class="['detail__message', `is-${message.status}`]" aria-live="polite">
          <span class="detail__message-icon" aria-hidden="true">
            <AppIcon :name="message.status === 'success' ? 'check' : 'close'" :size="18" />
          </span>
          <p
            data-testid="add-to-cart-message"
            :data-status="message.status"
            class="detail__message-text"
          >{{ message.text }}</p>
          <RouterLink v-if="message.status === 'success'" to="/cart" class="btn btn--dark btn--sm" data-testid="go-to-cart">
            장바구니로 이동
          </RouterLink>
        </div>

        <p class="detail__trust"><AppIcon name="shield" :size="18" /> 데모 쇼핑몰입니다. 실제 결제·배송은 이루어지지 않습니다.</p>
      </div>
    </div>

    <nav class="detail-tabs" aria-label="상품 상세 메뉴">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        :class="['detail-tabs__btn', { 'is-active': activeTab === tab.id }]"
        :aria-current="activeTab === tab.id ? 'true' : undefined"
        @click="scrollToTab(tab.id)"
      >{{ tab.label }}</button>
    </nav>

    <section id="tab-info" class="detail__section" aria-labelledby="spec-title">
      <h2 id="spec-title" class="detail__section-title">상품 정보</h2>
      <dl v-if="PRODUCT_SPECS[product.id]" class="spec-table">
        <div v-for="[label, value] in PRODUCT_SPECS[product.id]" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
      <p v-else class="detail__desc">{{ product.description }}</p>
    </section>

    <section id="tab-delivery" class="detail__section" aria-labelledby="delivery-title">
      <h2 id="delivery-title" class="detail__section-title">배송·반품 안내</h2>
      <ul class="policy-cards">
        <li>
          <AppIcon name="truck" :size="26" />
          <strong>무료 배송</strong>
          <span>금액 조건 없이 전 상품 무료로 보내 드려요.</span>
        </li>
        <li>
          <AppIcon name="clock" :size="26" />
          <strong>평일 당일 출고</strong>
          <span>평일 오후 2시 이전 주문은 그날 출고해요.</span>
        </li>
        <li>
          <AppIcon name="return" :size="26" />
          <strong>7일 무료 반품</strong>
          <span>받은 날부터 7일 이내라면 무료로 반품할 수 있어요.</span>
        </li>
      </ul>
    </section>
  </article>
</template>
