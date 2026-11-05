<script setup>
import { BENEFITS } from '../data/storefront.js'
</script>

<template>
  <div class="auth">
    <aside class="auth__aside" aria-hidden="true">
            <p class="auth__headline">책상 위<br />작업 환경을<br />가볍게.</p>
      <ul class="auth__benefits">
        <li v-for="benefit in BENEFITS" :key="benefit.title">
          <strong>{{ benefit.title }}</strong>
          <span>{{ benefit.text }}</span>
        </li>
      </ul>
    </aside>
    <section class="auth__panel">
      <slot />
    </section>
  </div>
</template>
