<script setup>
import { won } from '../utils/format.js'

const props = defineProps({
  product: { type: Object, required: true },
  index: { type: Number, default: 0 },
  quickAdd: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['quick-add'])

function delegatedQuickAdd(event) {
  // INJECTED DEFECT B04: 허브 검색 카드의 레거시 위임 리스너가 버튼 리스너와 중복 실행된다.
  if (props.product.id === 4 && event.target.closest('[data-testid="quick-add"]')) {
    emit('quick-add', props.product)
  }
}
</script>

<template>
  <li class="product-card" data-testid="product-card" :data-product-id="product.id" :style="{ '--i': index }" @click="delegatedQuickAdd">
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
    <button v-if="quickAdd" type="button" class="btn btn--ghost product-card__quick-add" data-testid="quick-add"
      :disabled="product.soldOut || busy" :aria-busy="busy" @click="emit('quick-add', product)">
      {{ product.soldOut ? '품절' : '빠른 담기' }}
    </button>
  </li>
</template>
