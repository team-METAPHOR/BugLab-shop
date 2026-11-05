<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logout, session } from '../stores/session.js'
import { BENEFITS, CATEGORY_LINKS, CATEGORY_SHORTCUTS, SUGGESTED_KEYWORDS } from '../data/storefront.js'
import AppIcon from './AppIcon.vue'
import BrandLogo from './BrandLogo.vue'
import { favorites, loadFavorites, resetFavorites } from '../stores/favorites.js'
import ActionNotice from './ActionNotice.vue'
import { useActionNotice } from '../composables/useActionNotice.js'

const route = useRoute()
const router = useRouter()
const keyword = ref(typeof route.query.q === 'string' ? route.query.q : '')
const loggingOut = ref(false)
const scrolled = ref(false)
const menuOpen = ref(false)
const tickerOpen = ref(false)
const cartBump = ref(false)
const menuButton = ref(null)
const tickerEl = ref(null)
const gnbList = ref(null)
const headerEl = ref(null)
const indicator = ref({ left: 0, width: 0, visible: false })
const { notice: categoryNotice, announce: announceCategory, clear: clearCategory } = useActionNotice()
const tickerWords = [...SUGGESTED_KEYWORDS, SUGGESTED_KEYWORDS[0]]

watch(() => session.user?.id, (id) => {
  resetFavorites()
  if (id) loadFavorites().catch(() => {})
}, { immediate: true })

const activeQuery = computed(() =>
  route.path === '/' ? (typeof route.query.q === 'string' ? route.query.q.trim() : '') : null,
)

watch(
  () => route.query.q,
  (q) => {
    keyword.value = typeof q === 'string' ? q : ''
  },
)

watch(
  () => route.fullPath,
  () => {
    clearCategory()
    menuOpen.value = false
    tickerOpen.value = false
    nextTick(resetIndicator)
  },
)

let bumpTimer = null
watch(
  () => session.cartCount,
  (next, prev) => {
    if (next <= prev) return
    cartBump.value = false
    clearTimeout(bumpTimer)
    requestAnimationFrame(() => {
      cartBump.value = true
      bumpTimer = setTimeout(() => (cartBump.value = false), 600)
    })
  },
)

function submitSearch() {
  const q = keyword.value.trim()
  tickerOpen.value = false
  router.push(q ? { path: '/', query: { q } } : { path: '/' })
}

async function chooseCategory(event, item, navigate) {
  await navigate(event)
  if (item.q === '허브') {
    // 경로 변경 때 확인 문구를 지우는 watcher가 먼저 실행된 뒤 갱신한다.
    await nextTick()
    announceCategory('카테고리 선택 확인 완료')
  }
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

function toggleMenu() {
  menuOpen.value = !menuOpen.value
  tickerOpen.value = false
}

function closeMenu({ restoreFocus = false } = {}) {
  if (!menuOpen.value) return
  menuOpen.value = false
  if (restoreFocus) menuButton.value?.focus()
}

// 카테고리 메뉴 밑줄이 마우스를 따라 움직인다. 마우스가 빠지면 현재 메뉴로 돌아간다.
function moveIndicator(target) {
  if (!target || !gnbList.value) {
    indicator.value = { ...indicator.value, visible: false }
    return
  }
  const listRect = gnbList.value.getBoundingClientRect()
  const rect = target.getBoundingClientRect()
  indicator.value = { left: rect.left - listRect.left + gnbList.value.scrollLeft, width: rect.width, visible: true }
}

function resetIndicator() {
  moveIndicator(gnbList.value?.querySelector('.gnb__link.is-active'))
}

let ticking = false
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    scrolled.value = window.scrollY > 40
    ticking = false
  })
}

function onKeydown(event) {
  if (event.key !== 'Escape') return
  if (menuOpen.value) closeMenu({ restoreFocus: true })
  tickerOpen.value = false
}

function onPointerDown(event) {
  if (tickerOpen.value && tickerEl.value && !tickerEl.value.contains(event.target)) tickerOpen.value = false
}

// 상세 탭·장바구니 요약 같은 sticky 요소가 실제 헤더 높이 아래에 붙도록 높이를 CSS 변수로 알려 준다.
let headerObserver = null
function publishHeaderHeight() {
  if (!headerEl.value) return
  document.documentElement.style.setProperty('--sticky-top', `${Math.ceil(headerEl.value.getBoundingClientRect().height)}px`)
}

onMounted(() => {
  if ('ResizeObserver' in window) {
    headerObserver = new ResizeObserver(publishHeaderHeight)
    headerObserver.observe(headerEl.value)
  }
  publishHeaderHeight()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', resetIndicator)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown, true)
  onScroll()
  nextTick(resetIndicator)
})

onBeforeUnmount(() => {
  headerObserver?.disconnect()
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', resetIndicator)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown, true)
  clearTimeout(bumpTimer)
})
</script>

<template>
  <p class="topbar">
    <span class="topbar__inner">
      <span class="nowrap">전 상품 무료 배송</span>
      <span class="topbar__coupon">장바구니에서 쿠폰 <strong>SAVE5000</strong> 입력 시 <span class="nowrap">5,000원 할인</span></span>
    </span>
  </p>

  <header ref="headerEl" :class="['site-header', { 'is-scrolled': scrolled || menuOpen }]">
    <div class="site-header__inner">
      <button
        ref="menuButton"
        :class="['menu-btn', { 'is-open': menuOpen }]"
        type="button"
        :aria-expanded="menuOpen"
        aria-controls="mega-menu"
        @click="toggleMenu"
      >
        <AppIcon :name="menuOpen ? 'close' : 'menu'" :size="26" />
        <span class="sr-only">{{ menuOpen ? '전체 카테고리 닫기' : '전체 카테고리 열기' }}</span>
      </button>

      <RouterLink to="/" class="logo" aria-label="BugLab Shop 홈">
        <BrandLogo />
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
        <button data-testid="search-submit" class="search__btn" type="submit">
          <AppIcon name="search" :size="18" />
          <span class="search__btn-label">검색</span>
        </button>
      </form>

      <div
        ref="tickerEl"
        :class="['ticker', { 'is-open': tickerOpen }]"
        @mouseenter="tickerOpen = true"
        @mouseleave="tickerOpen = false"
      >
        <button
          class="ticker__btn"
          type="button"
          :aria-expanded="tickerOpen"
          aria-controls="ticker-list"
          @click="tickerOpen = !tickerOpen"
        >
          <span class="ticker__window" aria-hidden="true">
            <span class="ticker__track">
              <span v-for="(word, index) in tickerWords" :key="index" class="ticker__item">
                <b>{{ (index % SUGGESTED_KEYWORDS.length) + 1 }}</b>{{ word }}
              </span>
            </span>
          </span>
          <span class="sr-only">추천 검색어 보기</span>
          <AppIcon class="ticker__chevron" name="chevron-down" :size="18" />
        </button>
        <Transition name="pop">
          <div v-if="tickerOpen" id="ticker-list" class="ticker__panel">
            <p class="ticker__title">추천 검색어</p>
            <ol class="ticker__list">
              <li v-for="(word, index) in SUGGESTED_KEYWORDS" :key="word">
                <RouterLink :to="{ path: '/', query: { q: word } }" class="ticker__link">
                  <b>{{ index + 1 }}</b>{{ word }}
                </RouterLink>
              </li>
            </ol>
          </div>
        </Transition>
      </div>

      <nav class="header-actions" aria-label="사용자 메뉴">
        <RouterLink to="/favorites" class="header-action" data-testid="favorites-link" aria-label="찜한 상품">
          <AppIcon name="heart" :size="28" />
          <span class="header-action__label">찜 <span v-if="session.user" data-testid="favorites-count">{{ favorites.items.length }}</span></span>
        </RouterLink>
        <div v-if="session.user" class="header-action header-action--user">
          <AppIcon name="user" :size="30" />
          <span class="header-action__label user-name" data-testid="user-menu">{{ session.user.name }}님</span>
        </div>
        <RouterLink
          v-else-if="session.loaded"
          :to="{ path: '/login', query: route.path === '/login' ? route.query : { next: route.fullPath } }"
          class="header-action"
          data-testid="login-link"
          aria-label="로그인"
        >
          <AppIcon name="user" :size="30" />
          <span class="header-action__label">로그인</span>
        </RouterLink>
        <span v-else class="header-action header-action--placeholder" aria-hidden="true">
          <AppIcon name="user" :size="30" />
          <span class="header-action__label">&nbsp;</span>
        </span>

        <RouterLink
          to="/cart"
          class="header-action cart-link"
          data-testid="cart-link"
          :aria-label="session.user ? `장바구니, 담은 수량 ${session.cartCount}개` : '장바구니'"
        >
          <span class="cart-link__icon">
            <AppIcon name="cart" :size="30" />
            <span
              v-if="session.user"
              :class="['cart-link__count', { 'is-bump': cartBump }]"
              data-testid="cart-count"
            >{{ session.cartCount }}</span>
          </span>
          <span class="header-action__label">장바구니</span>
        </RouterLink>
      </nav>
    </div>

    <Transition name="mega">
      <div v-if="menuOpen" id="mega-menu" class="mega" role="region" aria-label="전체 카테고리">
        <div class="mega__inner">
          <section class="mega__col mega__col--wide">
            <p class="mega__heading">카테고리</p>
            <ul class="mega__cats">
              <li v-for="item in CATEGORY_SHORTCUTS" :key="item.q">
                <RouterLink :to="{ path: '/', query: { q: item.q } }" custom v-slot="{ href, navigate }">
                  <a :href="href" class="mega__cat" data-testid="mega-category-link" :data-category="item.q" @click="chooseCategory($event, item, navigate)">
                    <img :src="item.image" alt="" width="64" height="48" />
                    <span>{{ item.label }}</span>
                    <AppIcon name="chevron-right" :size="16" />
                  </a>
                </RouterLink>
              </li>
            </ul>
            <RouterLink to="/" class="mega__all">전체 상품 보기 <AppIcon name="arrow-right" :size="16" /></RouterLink>
          </section>
          <section class="mega__col">
            <p class="mega__heading">쇼핑 혜택</p>
            <ul class="mega__benefits">
              <li v-for="benefit in BENEFITS" :key="benefit.title">
                <AppIcon :name="benefit.icon" :size="22" />
                <span><strong>{{ benefit.title }}</strong>{{ benefit.text }}</span>
              </li>
            </ul>
          </section>
          <section class="mega__col">
            <p class="mega__heading">이번 주 쿠폰</p>
            <RouterLink to="/cart" class="mega__coupon">
              <span class="mega__coupon-amount">5,000원</span>
              <span class="mega__coupon-note">장바구니에서 입력하세요</span>
              <span class="mega__coupon-code">SAVE5000</span>
            </RouterLink>
          </section>
        </div>
      </div>
    </Transition>
  </header>

  <Transition name="fade">
    <div v-if="menuOpen" class="mega-backdrop" aria-hidden="true" @click="closeMenu()" />
  </Transition>

  <nav class="gnb" aria-label="카테고리">
    <div class="gnb__inner">
      <div ref="gnbList" class="gnb__list" @mouseleave="resetIndicator">
        <RouterLink
          v-for="item in CATEGORY_LINKS"
          :key="item.label"
          :to="item.q ? { path: '/', query: { q: item.q } } : { path: '/' }"
          custom v-slot="{ href, navigate }"
        >
          <a :href="href" :class="['gnb__link', { 'is-active': activeQuery === item.q }]"
            data-testid="category-link" :data-category="item.q"
            @mouseenter="moveIndicator($event.currentTarget)" @focus="moveIndicator($event.currentTarget)"
            @click="chooseCategory($event, item, navigate)">
            {{ item.label }}<span v-if="item.bubble" class="gnb__bubble" aria-hidden="true">{{ item.bubble }}</span>
          </a>
        </RouterLink>
        <span
          class="gnb__indicator"
          :style="{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px`, opacity: indicator.visible ? 1 : 0 }"
          aria-hidden="true"
        />
      </div>
      <div class="gnb__util">
        <template v-if="session.user">
          <button
            data-testid="logout"
            class="gnb__util-link"
            type="button"
            :disabled="loggingOut"
            :aria-busy="loggingOut"
            @click="onLogout"
          >
            로그아웃
          </button>
        </template>
        <RouterLink v-else-if="session.loaded" :to="{ path: '/signup', query: route.query.next ? { next: route.query.next } : {} }" class="gnb__util-link">회원가입</RouterLink>
        <RouterLink to="/credits" class="gnb__util-link gnb__util-link--wide">이미지 출처</RouterLink>
      </div>
    </div>
  </nav>
  <ActionNotice :notice="categoryNotice" data-testid="category-status" class="category-feedback" />
</template>
