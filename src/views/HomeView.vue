<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '../api/client.js'
import { clearSession, session, setCartCount } from '../stores/session.js'
import ProductCard from '../components/ProductCard.vue'
import HeroCarousel from '../components/HeroCarousel.vue'
import AppIcon from '../components/AppIcon.vue'
import { vReveal } from '../directives/reveal.js'
import { BENEFITS, CATEGORY_SHORTCUTS, HERO_SLIDES, SETUP_GUIDE, SUGGESTED_KEYWORDS } from '../data/storefront.js'

const route = useRoute()
const router = useRouter()
const quickAddPending = ref(0)
const quickAddMessage = ref('')
let quickAddQueue = Promise.resolve()
const products = ref([])
const summary = ref(null)
const status = ref('loading') // loading | ready | error
const errorMessage = ref('')
const sort = ref('recommended')
const catalogEl = ref(null)
let requestSeq = 0

const SORTS = [
  { value: 'recommended', label: '추천순' },
  { value: 'price-asc', label: '낮은 가격순' },
  { value: 'price-desc', label: '높은 가격순' },
]

const query = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))

// 화면 정렬만 바꾼다. 목록 데이터(products)는 그대로 둔다.
const sortedProducts = computed(() => {
  if (sort.value === 'recommended') return products.value
  const list = [...products.value]
  list.sort((a, b) => (sort.value === 'price-asc' ? a.price - b.price : b.price - a.price))
  return list
})

async function load(q) {
  const seq = ++requestSeq
  status.value = 'loading'
  try {
    const path = q ? `/api/products?q=${encodeURIComponent(q)}` : '/api/products'
    const data = await api.get(path)
    if (seq !== requestSeq) return
    summary.value = q ? { query: q, count: data.items.length } : null
    products.value = data.items
    status.value = 'ready'
  } catch (error) {
    if (seq !== requestSeq) return
    errorMessage.value = error.message
    status.value = 'error'
  }
}

watch(query, (q) => load(q), { immediate: true })

function quickAdd(product) {
  if (!session.user) {
    router.push({ path: '/login', query: { next: route.fullPath } })
    return
  }
  quickAddPending.value++
  quickAddMessage.value = ''
  const userId = session.user.id
  // 같은 클릭에서 전달된 작업도 순서대로 완료해 배지와 서버 수량을 일치시킨다.
  quickAddQueue = quickAddQueue.then(async () => {
    try {
      if (session.user?.id !== userId) return
      const cart = await api.post('/api/cart/items', { productId: product.id, quantity: 1 })
      if (session.user?.id !== userId) return
      setCartCount(cart)
      quickAddMessage.value = '장바구니에 담았습니다.'
    } catch (error) {
      quickAddMessage.value = error.message
      if (error instanceof ApiError && error.status === 401) {
        clearSession()
        router.push({ path: '/login', query: { next: route.fullPath } })
      }
    } finally {
      quickAddPending.value--
    }
  })
}

// 쿠폰 코드 복사. 클립보드를 못 쓰는 환경(비보안 origin 등)에서는 코드를 선택해 두고 직접 복사하도록 안내한다.
const couponCodeEl = ref(null)
const copyState = ref('idle') // idle | copied | selected
const copyMessage = computed(() =>
  copyState.value === 'copied' ? '쿠폰 코드를 복사했습니다.' : copyState.value === 'selected' ? '코드를 선택했습니다. 직접 복사해 주세요.' : '',
)
let copyTimer = null

async function copyCoupon() {
  clearTimeout(copyTimer)
  try {
    await navigator.clipboard.writeText('SAVE5000')
    copyState.value = 'copied'
  } catch {
    const range = document.createRange()
    range.selectNodeContents(couponCodeEl.value)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    copyState.value = 'selected'
  }
  copyTimer = setTimeout(() => (copyState.value = 'idle'), 2400)
}

onBeforeUnmount(() => clearTimeout(copyTimer))

function scrollToCatalog() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  catalogEl.value?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}
</script>

<template>
  <h1 class="sr-only">BugLab Shop 데스크 셋업 전문몰</h1>
  <template v-if="!query">
    <HeroCarousel :slides="HERO_SLIDES" @scroll-to-catalog="scrollToCatalog" />

    <div class="container">
      <ul class="benefits" aria-label="쇼핑 혜택">
        <li v-for="benefit in BENEFITS" :key="benefit.title" class="benefits__item">
          <span class="benefits__icon" aria-hidden="true"><AppIcon :name="benefit.icon" :size="20" /></span>
          <strong>{{ benefit.title }}</strong>
          <span class="benefits__text">{{ benefit.text }}</span>
        </li>
      </ul>

      <section class="home-section shortcut-section" aria-labelledby="shortcut-title">
        <div class="shortcut-section__head">
          <h2 id="shortcut-title" class="section-title">카테고리 <br />바로가기</h2>
        </div>
        <ul class="shortcuts">
          <li v-for="item in CATEGORY_SHORTCUTS" :key="item.q">
            <RouterLink :to="{ path: '/', query: { q: item.q } }" class="shortcut">
              <span class="shortcut__thumb"><img :src="item.image" alt="" width="1000" height="750" loading="lazy" /></span>
              <span class="shortcut__meta">
                <span class="shortcut__label">{{ item.label }}</span>
                <AppIcon name="arrow-right" :size="16" />
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>
  </template>

  <div class="container">
    <section id="catalog" ref="catalogEl" class="catalog home-section" :aria-busy="status === 'loading'">
      <div class="catalog__head">
        <div class="catalog__heading">
          <h2 class="section-title">{{ query ? '검색 결과' : '추천 상품' }}</h2>
          <p v-if="summary" class="catalog__summary" data-testid="search-summary">
            '{{ summary.query }}' 검색 결과 {{ summary.count }}개
          </p>
        </div>
        <div class="sort-tabs" role="group" aria-label="정렬">
          <button
            v-for="option in SORTS"
            :key="option.value"
            type="button"
            :class="['sort-tabs__btn', { 'is-active': sort === option.value }]"
            :aria-pressed="sort === option.value"
            @click="sort = option.value"
          >{{ option.label }}</button>
        </div>
      </div>

      <div v-if="query" class="keyword-chips" aria-label="다른 검색어">
        <span class="keyword-chips__label">다른 검색어</span>
        <RouterLink
          v-for="word in SUGGESTED_KEYWORDS.filter((w) => w !== query)"
          :key="word"
          :to="{ path: '/', query: { q: word } }"
          class="chip"
        >{{ word }}</RouterLink>
      </div>

      <p v-if="status === 'error'" class="notice notice--error" role="alert">{{ errorMessage }}</p>

      <ul class="product-grid" data-testid="search-results">
        <ProductCard v-for="(product, index) in sortedProducts" :key="product.id" :product="product" :index="index"
          :quick-add="Boolean(query)" :busy="quickAddPending > 0" @quick-add="quickAdd" />
      </ul>
      <div v-if="query && quickAddMessage" class="quick-add-result" aria-live="polite">
        <p data-testid="quick-add-message">{{ quickAddMessage }}</p>
        <RouterLink to="/cart" class="text-link" data-testid="quick-add-go-to-cart">장바구니로 이동</RouterLink>
      </div>

      <div v-if="status === 'loading' && products.length === 0" class="product-grid product-grid--skeleton" aria-hidden="true">
        <div v-for="n in 6" :key="n" class="skeleton-card">
          <span class="skeleton skeleton--image" />
          <span class="skeleton skeleton--line" />
          <span class="skeleton skeleton--line skeleton--short" />
        </div>
      </div>

      <div v-if="status === 'ready' && products.length === 0" class="empty-state">
        <p class="empty" data-testid="empty-results">
          검색 결과가 없습니다.
        </p>
        <p class="empty-state__hint">검색어의 철자를 확인하거나 다른 검색어로 찾아보세요.</p>
        <RouterLink to="/" class="text-link">전체 상품 보기 <AppIcon name="arrow-right" :size="16" /></RouterLink>
      </div>
    </section>

    <section v-if="!query" v-reveal class="home-section setup" aria-labelledby="setup-title">
      <figure class="setup__photo">
        <img :src="SETUP_GUIDE.image" alt="" width="1000" height="750" loading="lazy" />
        <figcaption>사진 속 키보드·트랙패드는 매트 구성품이 아닙니다.</figcaption>
      </figure>
      <div class="setup__body">
        <p class="kicker">Setup guide</p>
        <h2 id="setup-title" class="section-title"><span v-for="line in SETUP_GUIDE.title" :key="line" class="setup__line">{{ line }}</span></h2>
        <p class="setup__reason">{{ SETUP_GUIDE.reason }}</p>
        <ol class="setup__list">
          <li v-for="(item, index) in SETUP_GUIDE.items" :key="item.id">
            <RouterLink :to="`/products/${item.id}`" class="setup__row">
              <span class="setup__no" aria-hidden="true">{{ index + 1 }}</span>
              <span class="setup__role">{{ item.role }}</span>
              <span class="setup__name">{{ item.name }}</span>
              <span class="setup__fact">{{ item.fact }}</span>
              <AppIcon class="setup__arrow" name="arrow-right" :size="18" />
            </RouterLink>
          </li>
        </ol>
      </div>
    </section>

    <section v-if="!query" class="home-section coupon-zone" aria-labelledby="coupon-zone-title">
      <h2 id="coupon-zone-title" class="coupon-zone__title">지금 쓸 수 있는 쿠폰</h2>
      <div class="coupon-card">
        <div class="coupon-card__main">
          <p class="coupon-card__amount">5,000원 할인</p>
          <p class="coupon-card__name">장바구니 쿠폰</p>
          <ul class="coupon-card__terms">
            <li>최소 주문 금액 없음</li>
            <li>한 장바구니에 한 번 사용</li>
            <li>장바구니의 쿠폰 코드 입력란에 입력</li>
          </ul>
        </div>
        <div class="coupon-card__side">
          <p class="coupon-card__code-label">쿠폰 코드</p>
          <p ref="couponCodeEl" class="coupon-card__code">SAVE5000</p>
          <div class="coupon-card__actions">
            <button type="button" class="btn btn--ghost btn--sm coupon-card__copy" @click="copyCoupon">
              <AppIcon :name="copyState === 'copied' ? 'check' : 'ticket'" :size="16" />
              {{ copyState === 'copied' ? '복사했어요' : '코드 복사' }}
            </button>
            <RouterLink to="/cart" class="text-link">장바구니로 <AppIcon name="arrow-right" :size="16" /></RouterLink>
          </div>
          <p class="coupon-card__status" aria-live="polite">{{ copyMessage }}</p>
        </div>
      </div>
    </section>
  </div>
</template>
