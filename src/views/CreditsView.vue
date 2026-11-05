<script setup>
import { PHOTO_CREDITS } from '../data/photoCredits.js'
</script>

<template>
  <section class="credits">
    <h1 class="page-title">이미지 출처</h1>
    <p class="credits__intro">
      상품·배너 사진은 <a href="https://unsplash.com/?utm_source=buglab_shop&amp;utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>에서
      <a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">Unsplash License</a>로 제공받았습니다.
      사진 속 제품은 실제 판매 상품과 다를 수 있습니다.
    </p>
    <ul class="credits__list">
      <li v-for="credit in PHOTO_CREDITS" :key="credit.file" class="credits__item">
        <img :src="credit.file" :alt="credit.label" width="160" height="120" loading="lazy" />
        <div>
          <p class="credits__label">{{ credit.label }}</p>
          <p class="credits__by">
            Photo by
            <a :href="credit.photographerUrl" target="_blank" rel="noopener noreferrer">{{ credit.photographer }}</a>
            on
            <a :href="credit.photoUrl" target="_blank" rel="noopener noreferrer">Unsplash</a>
          </p>
        </div>
      </li>
    </ul>
  </section>
</template>
