<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logout, session } from '../stores/session.js'

const route = useRoute()
const router = useRouter()
const keyword = ref(typeof route.query.q === 'string' ? route.query.q : '')
const loggingOut = ref(false)

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
    <div class="site-header__inner">
      <RouterLink to="/" class="logo" aria-label="BugLab Shop 홈">
        <span class="logo__mark" aria-hidden="true">B</span>
        <span>BugLab Shop</span>
      </RouterLink>

      <form class="search" role="search" @submit.prevent="submitSearch">
        <input
          v-model="keyword"
          data-testid="search-input"
          class="search__input"
          type="search"
          name="q"
          placeholder="찾으시는 상품을 검색해 보세요"
          aria-label="상품 검색"
          autocomplete="off"
        />
        <button data-testid="search-submit" class="btn btn--primary" type="submit">검색</button>
      </form>

      <nav class="header-actions" aria-label="사용자 메뉴">
        <RouterLink to="/cart" class="cart-link" data-testid="cart-link">
          장바구니
          <span v-if="session.user" class="cart-link__count" data-testid="cart-count">{{ session.cartCount }}</span>
        </RouterLink>
        <template v-if="session.user">
          <span class="user-name" data-testid="user-menu">{{ session.user.name }}님</span>
          <button
            data-testid="logout"
            class="btn btn--ghost"
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
          class="btn btn--ghost"
          data-testid="login-link"
        >
          로그인
        </RouterLink>
      </nav>
    </div>
  </header>
</template>
