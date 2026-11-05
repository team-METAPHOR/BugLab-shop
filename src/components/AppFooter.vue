<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api/client.js'

const envLabel = ref('')

onMounted(async () => {
  try {
    const health = await api.get('/api/health')
    envLabel.value = `${health.env} · ${health.commit}`
  } catch {
    envLabel.value = ''
  }
})
</script>

<template>
  <footer class="site-footer">
    <div class="site-footer__inner">
      <div class="site-footer__brand">
        <p class="site-footer__logo">BugLab Shop</p>
        <p>책상 위 작업 환경을 위한 키보드·마우스·데스크 액세서리를 고릅니다.</p>
      </div>

      <div class="site-footer__col">
        <p class="site-footer__heading">배송·반품 안내</p>
        <p>전 상품 무료 배송</p>
        <p>평일 오후 2시 이전 주문 시 당일 출고</p>
        <p>받은 날부터 7일 이내 무료 반품</p>
      </div>

      <div class="site-footer__col">
        <p class="site-footer__heading">쇼핑</p>
        <RouterLink to="/">전체 상품</RouterLink>
        <RouterLink to="/cart">장바구니</RouterLink>
        <RouterLink to="/credits">이미지 출처</RouterLink>
      </div>
    </div>

    <div class="site-footer__bottom">
      <p>© 2026 BugLab Shop. 데모용 가상 쇼핑몰이며 실제 결제가 이루어지지 않습니다.</p>
      <small v-if="envLabel" class="env-label" data-testid="app-env">{{ envLabel }}</small>
    </div>
  </footer>
</template>
