import { nextTick, reactive } from 'vue'

// 페이지와 별개로 표시하는 공통 배송 안내 패널.
export const delivery = reactive({ product: null })
let opener = null

export function openDelivery(product, element) {
  opener = element
  delivery.product = { id: product.id, name: product.name }
}

export function closeDelivery() {
  const returnTo = opener
  delivery.product = null
  opener = null
  // 배경의 inert 해제가 반영된 뒤 원래 버튼으로 포커스를 돌린다.
  nextTick(() => { if (returnTo?.isConnected) returnTo.focus() })
}
