<script setup>
import { won } from '../utils/format.js'

defineProps({
  product: { type: Object, required: true },
})
</script>

<template>
  <li class="product-card" data-testid="product-card" :data-product-id="product.id">
    <RouterLink :to="`/products/${product.id}`" class="product-card__link">
      <div class="product-card__image">
        <img :src="product.imageUrl" :alt="product.name" width="400" height="300" />
        <span v-if="product.soldOut" class="badge badge--soldout" data-testid="sold-out-badge">품절</span>
      </div>
      <div class="product-card__body">
        <span class="product-card__category">{{ product.category }}</span>
        <span class="product-card__name">{{ product.name }}</span>
        <span class="product-card__price">{{ won(product.price) }}</span>
      </div>
    </RouterLink>
  </li>
</template>
