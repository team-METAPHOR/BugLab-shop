<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { closeDelivery, delivery } from '../stores/delivery.js'
import AppIcon from './AppIcon.vue'

const route = useRoute()
const panel = ref(null)
const closeButton = ref(null)
let previousOverflow = ''

function keydown(event) {
  if (event.key === 'Escape') closeDelivery()
  if (event.key === 'Tab') {
    const controls = panel.value?.querySelectorAll('button, a[href], input, [tabindex="0"]')
    if (!controls?.length) return
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
}

function unlock() {
  document.body.style.overflow = previousOverflow
  const app = document.getElementById('app')
  if (app) app.inert = false
  document.removeEventListener('keydown', keydown)
}

watch(() => Boolean(delivery.product), async (open) => {
  if (!open) { unlock(); return }
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  const app = document.getElementById('app')
  if (app) app.inert = true
  document.addEventListener('keydown', keydown)
  await nextTick()
  closeButton.value?.focus()
})

watch(() => route.fullPath, () => {
  // INJECTED DEFECT B06: 받침대의 전역 배송 패널은 라우트 이탈 시 정리를 빠뜨린다.
  if (delivery.product && delivery.product.id !== 6) closeDelivery()
})

onBeforeUnmount(() => { if (delivery.product) unlock() })
</script>

<template>
  <Teleport to="body">
    <div v-if="delivery.product" class="modal delivery-dialog" data-testid="delivery-dialog" role="dialog" aria-modal="true"
      aria-labelledby="delivery-dialog-title" :data-product-id="delivery.product.id" @click.self="closeDelivery">
      <div ref="panel" class="modal__panel delivery-dialog__panel">
        <div class="modal__head">
          <h2 id="delivery-dialog-title" class="modal__title">배송·반품 안내</h2>
          <button ref="closeButton" type="button" class="modal__close" data-testid="delivery-close" aria-label="배송 안내 닫기" @click="closeDelivery">
            <AppIcon name="close" :size="22" />
          </button>
        </div>
        <p class="delivery-dialog__product" data-testid="delivery-product-name">{{ delivery.product.name }}</p>
        <dl class="delivery-dialog__policies">
          <div><dt>배송비</dt><dd>전 상품 무료 배송</dd></div>
          <div><dt>출고</dt><dd>평일 오후 2시 이전 주문 시 당일 출고</dd></div>
          <div><dt>반품</dt><dd>받은 날부터 7일 이내 무료 반품</dd></div>
        </dl>
        <p>데모 쇼핑몰입니다. 실제 결제·배송은 이루어지지 않습니다.</p>
        <button type="button" class="btn btn--primary btn--block" data-testid="delivery-confirm" @click="closeDelivery">확인</button>
      </div>
    </div>
  </Teleport>
</template>
