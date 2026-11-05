<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '../api/client.js'
import { clearSession, setCartCount } from '../stores/session.js'
import { discountWon, won } from '../utils/format.js'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const cart = ref(null)
const status = ref('loading') // loading | ready | error
const pending = ref(null) // 진행 중인 작업 키
const couponCode = ref('')
const couponMessage = ref(null) // { status, text }
const itemError = ref('')

const isEmpty = computed(() => !cart.value || cart.value.items.length === 0)
const couponInput = ref(null)

function handleAuthError(error) {
  if (error instanceof ApiError && error.status === 401) {
    clearSession()
    router.replace({ path: '/login', query: { next: route.fullPath } })
    return true
  }
  return false
}

function applyCart(next) {
  cart.value = next
  setCartCount(next)
}

async function load() {
  status.value = 'loading'
  try {
    applyCart(await api.get('/api/cart'))
    status.value = 'ready'
  } catch (error) {
    if (handleAuthError(error)) return
    status.value = 'error'
  }
}

async function run(key, action) {
  if (pending.value) return
  pending.value = key
  itemError.value = ''
  try {
    applyCart(await action())
  } catch (error) {
    if (!handleAuthError(error)) itemError.value = error.message
  } finally {
    pending.value = null
  }
}

function changeQuantity(item, quantity) {
  run(`qty-${item.productId}`, () => api.patch(`/api/cart/items/${item.productId}`, { quantity }))
}

function removeItem(item) {
  run(`remove-${item.productId}`, () => api.delete(`/api/cart/items/${item.productId}`))
}

async function applyCoupon() {
  if (pending.value) return
  const code = couponCode.value.trim()
  if (!code) {
    couponMessage.value = { status: 'error', text: '쿠폰 코드를 입력해 주세요.' }
    return
  }
  pending.value = 'coupon'
  couponMessage.value = null
  try {
    applyCart(await api.post('/api/cart/coupons', { code }))
    couponMessage.value = { status: 'success', text: '쿠폰이 적용되었습니다.' }
  } catch (error) {
    if (!handleAuthError(error)) couponMessage.value = { status: 'error', text: error.message }
  } finally {
    pending.value = null
  }
}

// 쿠폰 안내 칩을 누르면 입력란을 채운다. 적용은 사용자가 버튼으로 한다.
function fillCoupon(code) {
  couponCode.value = code
  couponInput.value?.focus()
}

onMounted(load)
</script>

<template>
  <div class="cart-head">
    <h1 class="page-title">장바구니</h1>
    <ol class="steps" aria-label="주문 단계">
      <li class="is-current" aria-current="step"><span>01</span>장바구니</li>
      <li><span>02</span>주문/결제</li>
      <li><span>03</span>주문 완료</li>
    </ol>
  </div>

  <p v-if="status === 'loading'" class="notice notice--loading" aria-busy="true">장바구니를 불러오는 중입니다.</p>
  <p v-else-if="status === 'error'" class="notice notice--error" role="alert">장바구니를 불러오지 못했습니다.</p>

  <section v-else-if="isEmpty" class="cart-empty">
    <span class="empty-state__icon" aria-hidden="true"><AppIcon name="cart" :size="36" /></span>
    <p data-testid="cart-empty">장바구니가 비어 있습니다.</p>
    <p class="cart-empty__hint">마음에 드는 상품을 담아 보세요. 전 상품 무료 배송이에요.</p>
    <RouterLink to="/" class="btn btn--primary">쇼핑 계속하기</RouterLink>
  </section>

  <div v-else class="cart-layout">
    <section class="cart-items" aria-label="담은 상품">
      <div class="cart-items__head">
        <p class="cart-items__title">담은 상품 <strong>{{ cart.items.length }}</strong></p>
        <p class="cart-items__ship"><AppIcon name="truck" :size="18" /> 전 상품 무료 배송</p>
      </div>
      <ul class="cart-list">
        <li v-for="item in cart.items" :key="item.productId" class="cart-row" data-testid="cart-item" :data-product-id="item.productId">
          <RouterLink :to="`/products/${item.productId}`" class="cart-row__thumb" tabindex="-1" aria-hidden="true">
            <img :src="item.imageUrl" alt="" class="cart-row__image" width="120" height="90" />
          </RouterLink>
          <div class="cart-row__info">
            <RouterLink :to="`/products/${item.productId}`" class="cart-row__name" data-testid="cart-item-name">{{ item.name }}</RouterLink>
            <span class="cart-row__unit">{{ won(item.unitPrice) }}</span>
            <span class="cart-row__meta">무료배송 · 평일 당일 출고</span>
          </div>
          <div class="qty" role="group" :aria-label="`${item.name} 수량`">
            <button
              data-testid="quantity-decrease"
              class="qty__btn"
              type="button"
              aria-label="수량 줄이기"
              :disabled="item.quantity <= 1 || pending !== null"
              :aria-busy="pending === `qty-${item.productId}`"
              @click="changeQuantity(item, item.quantity - 1)"
            >−</button>
            <span class="qty__value" data-testid="cart-quantity" aria-live="polite">{{ item.quantity }}</span>
            <button
              data-testid="quantity-increase"
              class="qty__btn"
              type="button"
              aria-label="수량 늘리기"
              :disabled="item.quantity >= item.maxQuantity || pending !== null"
              :aria-busy="pending === `qty-${item.productId}`"
              @click="changeQuantity(item, item.quantity + 1)"
            >+</button>
          </div>
          <span class="cart-row__total" data-testid="cart-line-total">{{ won(item.lineTotal) }}</span>
          <button
            data-testid="remove-item"
            class="cart-row__remove"
            type="button"
            :aria-label="`${item.name} 삭제`"
            :disabled="pending !== null"
            :aria-busy="pending === `remove-${item.productId}`"
            @click="removeItem(item)"
          >
            <AppIcon name="trash" :size="18" />
            <span>삭제</span>
          </button>
        </li>
      </ul>
      <p v-if="itemError" class="notice notice--error" role="alert">{{ itemError }}</p>
    </section>

    <aside class="cart-summary" aria-label="결제 예정 금액" :aria-busy="pending !== null">
      <form class="coupon" @submit.prevent="applyCoupon">
        <div class="coupon__head">
          <span class="coupon__title"><AppIcon name="ticket" :size="20" /> 쿠폰</span>
          <button class="coupon__suggest" type="button" @click="fillCoupon('SAVE5000')">
            SAVE5000 <span>5,000원 할인</span>
          </button>
        </div>
        <label class="field">
          <span class="field__label sr-only">쿠폰 코드</span>
          <div class="coupon__row">
            <input
              ref="couponInput"
              v-model="couponCode"
              data-testid="coupon-input"
              type="text"
              name="coupon"
              placeholder="쿠폰 코드를 입력하세요"
              autocomplete="off"
              aria-label="쿠폰 코드"
            />
            <button
              data-testid="apply-coupon"
              class="btn btn--dark"
              type="submit"
              :disabled="pending === 'coupon'"
              :aria-busy="pending === 'coupon'"
            >쿠폰 적용</button>
          </div>
        </label>
        <p
          v-if="couponMessage"
          data-testid="coupon-message"
          :data-status="couponMessage.status"
          :class="['coupon__message', couponMessage.status === 'error' ? 'is-error' : 'is-success']"
          aria-live="polite"
        >{{ couponMessage.text }}</p>
        <ul v-if="cart.appliedCoupons.length" class="coupon__applied" data-testid="applied-coupons" aria-label="적용된 쿠폰">
          <li v-for="(coupon, index) in cart.appliedCoupons" :key="`${coupon.code}-${index}`">
            <span>{{ coupon.code }}</span> <span>{{ discountWon(coupon.amount) }}</span>
          </li>
        </ul>
      </form>

      <dl class="amounts">
        <div class="amounts__row">
          <dt>상품 합계</dt>
          <dd><strong data-testid="cart-subtotal">{{ won(cart.subtotal) }}</strong></dd>
        </div>
        <div :class="['amounts__row', { 'amounts__row--discount': cart.discount > 0 }]">
          <dt>할인 금액</dt>
          <dd><strong data-testid="cart-discount">{{ discountWon(cart.discount) }}</strong></dd>
        </div>
        <div class="amounts__row">
          <dt>배송비</dt>
          <dd><span class="amounts__free">무료</span></dd>
        </div>
        <div class="amounts__row amounts__row--total">
          <dt>최종 결제 예정 금액</dt>
          <dd><strong data-testid="cart-total">{{ won(cart.total) }}</strong></dd>
        </div>
      </dl>

      <button class="btn btn--primary btn--xl btn--block" type="button" disabled aria-describedby="order-note">주문하기</button>
      <p id="order-note" class="order-note">데모에서는 결제를 지원하지 않습니다.</p>
    </aside>
  </div>
</template>
