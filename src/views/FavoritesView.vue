<script setup>
import { onMounted, ref } from 'vue'
import { favorites, loadFavorites, toggleFavorite } from '../stores/favorites.js'
import ProductCard from '../components/ProductCard.vue'

const loading = ref(true)
onMounted(async () => {
  try { await loadFavorites() } catch { /* 공통 오류 메시지를 표시한다. */ }
  finally { loading.value = false }
})
</script>

<template>
  <h1 class="page-title">찜한 상품</h1>
  <p v-if="favorites.error" class="notice notice--error" role="alert">{{ favorites.error }}</p>
  <p v-if="loading" class="notice" aria-busy="true">찜 목록을 불러오는 중입니다.</p>
  <template v-else>
    <p class="favorites-summary" data-testid="favorites-summary">찜한 상품 {{ favorites.items.length }}개</p>
    <p v-if="favorites.items.length === 0" class="empty" data-testid="favorites-empty">찜한 상품이 없습니다.</p>
    <ul v-else class="product-grid favorites-grid" data-testid="favorites-list">
      <li v-for="item in favorites.items" :key="item.productId" class="favorite-entry" data-testid="favorite-item" :data-product-id="item.productId">
        <ul><ProductCard :product="item.product" /></ul>
        <button type="button" class="btn btn--ghost btn--block" data-testid="favorite-remove" :disabled="favorites.pending"
          @click="toggleFavorite(item.product)">찜 해제</button>
      </li>
    </ul>
    <RouterLink to="/" class="text-link">쇼핑 계속하기</RouterLink>
  </template>
</template>
