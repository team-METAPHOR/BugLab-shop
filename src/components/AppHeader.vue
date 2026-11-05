<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logout, session } from '../stores/session.js'

const route = useRoute()
const router = useRouter()
const keyword = ref(typeof route.query.q === 'string' ? route.query.q : '')
const loggingOut = ref(false)

// 카테고리 메뉴는 검색어 바로가기다. 별도 카테고리 API를 두지 않는다.
const CATEGORY_LINKS = [
  { label: '전체 상품', q: '' },
  { label: '키보드', q: '키보드' },
  { label: '마우스', q: '마우스' },
  { label: 'USB 허브', q: '허브' },
  { label: '데스크 매트', q: '매트' },
  { label: '모니터 받침대', q: '받침대' },
]

const activeQuery = computed(() =>
  route.path === '/' ? (typeof route.query.q === 'string' ? route.query.q.trim() : '') : null,
)

watch(
  () => route.query.q,
  (q) => {
    keyword.value = typeof q === 'string' ? q : ''
  },
)

function submitSearch() {
  const q = keyword.value.trim()
  router.push(q ? { path: '/', query: { q } } : { path: '/' })
}

async function onLogout() {
  loggingOut.value = true
  try {
    await logout()
  } finally {
    loggingOut.value = false
    router.push('/')
  }
}
</script>

<template>
  <header class="site-header">
    <p class="topbar">
      <span class="nowrap">전 상품 무료 배송</span>
      <span class="topbar__dot" aria-hidden="true">·</span>
      <span>장바구니에서 쿠폰 <strong>SAVE5000</strong> 입력 시 <span class="nowrap">5,000원 할인</span></span>
    </p>

    <div class="site-header__inner">
      <RouterLink to="/" class="logo" aria-label="BugLab Shop 홈">
        <span class="logo__mark" aria-hidden="true">B</span>
        <span class="logo__text">BugLab<span class="logo__sub">Shop</span></span>
      </RouterLink>

      <form class="search" role="search" @submit.prevent="submitSearch">
        <input
          v-model="keyword"
          data-testid="search-input"
          class="search__input"
          type="search"
          name="q"
          placeholder="키보드, 마우스, 허브를 검색해 보세요"
          aria-label="상품 검색"
          autocomplete="off"
        />
        <button data-testid="search-submit" class="search__btn" type="submit">검색</button>
      </form>

      <nav class="header-actions" aria-label="사용자 메뉴">
        <template v-if="session.user">
          <span class="user-name" data-testid="user-menu">{{ session.user.name }}님</span>
          <button
            data-testid="logout"
            class="header-link"
            type="button"
            :disabled="loggingOut"
            :aria-busy="loggingOut"
            @click="onLogout"
          >
            로그아웃
          </button>
        </template>
        <RouterLink
          v-else-if="session.loaded"
          :to="{ path: '/login', query: route.path === '/login' ? route.query : { next: route.fullPath } }"
          class="header-link"
          data-testid="login-link"
        >
          로그인
        </RouterLink>
        <RouterLink to="/cart" class="cart-link" data-testid="cart-link">
          <svg class="cart-link__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.5L21 8H6.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="10" cy="20" r="1.4" fill="currentColor" />
            <circle cx="17" cy="20" r="1.4" fill="currentColor" />
          </svg>
          장바구니
          <span v-if="session.user" class="cart-link__count" data-testid="cart-count">{{ session.cartCount }}</span>
        </RouterLink>
      </nav>
    </div>

    <nav class="category-nav" aria-label="카테고리">
      <div class="category-nav__inner">
        <RouterLink
          v-for="item in CATEGORY_LINKS"
          :key="item.label"
          :to="item.q ? { path: '/', query: { q: item.q } } : { path: '/' }"
          :class="['category-nav__link', { 'is-active': activeQuery === item.q }]"
        >
          {{ item.label }}
        </RouterLink>
      </div>
    </nav>
  </header>
</template>
