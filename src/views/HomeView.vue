<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api/client.js'
import ProductCard from '../components/ProductCard.vue'

const route = useRoute()
const products = ref([])
const summary = ref(null)
const status = ref('loading') // loading | ready | error
const errorMessage = ref('')
let requestSeq = 0

const query = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))

async function load(q) {
  const seq = ++requestSeq
  status.value = 'loading'
  try {
    const path = q ? `/api/products?q=${encodeURIComponent(q)}` : '/api/products'
    const data = await api.get(path)
    if (seq !== requestSeq) return
    summary.value = q ? { query: q, count: data.items.length } : null
    // INJECTED DEFECT B03
    if (data.items.length > 0) {
      products.value = data.items
    }
    status.value = 'ready'
  } catch (error) {
    if (seq !== requestSeq) return
    errorMessage.value = error.message
    status.value = 'error'
  }
}

watch(query, (q) => load(q), { immediate: true })
</script>

<template>
  <section v-if="!query" class="hero">
    <div>
      <p class="hero__eyebrow">11월 데스크 셋업 위크</p>
      <h1 class="hero__title">책상 위를 가볍게,<br />작업은 더 빠르게</h1>
      <p class="hero__text">키보드·마우스·액세서리 전 상품 무료 배송. 장바구니에서 쿠폰 SAVE5000을 사용해 보세요.</p>
    </div>
  </section>

  <section class="catalog" :aria-busy="status === 'loading'">
    <div class="catalog__head">
      <h2 class="section-title">{{ query ? '검색 결과' : '추천 상품' }}</h2>
      <p v-if="summary" class="catalog__summary" data-testid="search-summary">
        '{{ summary.query }}' 검색 결과 {{ summary.count }}개
      </p>
    </div>

    <p v-if="status === 'error'" class="notice notice--error" role="alert">{{ errorMessage }}</p>

    <ul class="product-grid" data-testid="search-results">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </ul>

    <p v-if="status === 'ready' && products.length === 0" class="empty" data-testid="empty-results">
      검색 결과가 없습니다.
    </p>
  </section>
</template>
