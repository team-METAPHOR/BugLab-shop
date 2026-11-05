<script setup>
import AppIcon from '../components/AppIcon.vue'
</script>

<template>
  <section class="notice-page">
    <span class="notice-page__code" aria-hidden="true">404</span>
    <h1>페이지를 찾을 수 없습니다.</h1>
    <p class="notice-page__text">주소가 바뀌었거나 삭제된 페이지예요.</p>
    <RouterLink to="/" class="btn btn--primary">홈으로 <AppIcon name="arrow-right" :size="18" /></RouterLink>
  </section>
</template>
