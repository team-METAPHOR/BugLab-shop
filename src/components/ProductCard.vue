<script setup>
import { won } from '../utils/format.js'

defineProps({
  product: { type: Object, required: true },
  index: { type: Number, default: 0 },
})
</script>

<template>
  <li class="product-card" data-testid="product-card" :data-product-id="product.id" :style="{ '--i': index }">
    <RouterLink :to="`/products/${product.id}`" :class="['product-card__link', { 'is-soldout': product.soldOut }]">
      <div class="product-card__image">
        <img :src="product.imageUrl" :alt="product.name" width="1000" height="750" decoding="async" />
        <span v-if="product.soldOut" class="badge badge--soldout" data-testid="sold-out-badge">품절</span>
      </div>
      <div class="product-card__body">
        <span class="product-card__category">{{ product.category }}</span>
        <span class="product-card__name">{{ product.name }}</span>
        <span class="product-card__price">{{ won(product.price) }}</span>
        <span class="product-card__tags">
          <span>무료배송</span>
          <span v-if="!product.soldOut">빠른출고</span>
        </span>
      </div>
    </RouterLink>
  </li>
</template>
