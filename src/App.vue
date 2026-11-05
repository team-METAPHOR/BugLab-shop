<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import ScrollTopButton from './components/ScrollTopButton.vue'
import DeliveryDialog from './components/DeliveryDialog.vue'

const route = useRoute()
// 같은 화면 안에서 검색어·상품 id만 바뀔 때는 화면을 다시 만들지 않는다(기존 상태 유지).
const viewKey = computed(() => route.matched[0]?.path ?? route.path)
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main :class="['page', { 'page--wide': route.meta.wide }]">
      <RouterView v-slot="{ Component }">
        <div :key="viewKey" class="view-enter">
          <component :is="Component" />
        </div>
      </RouterView>
    </main>
    <AppFooter />
    <ScrollTopButton />
    <DeliveryDialog />
  </div>
</template>
