<script setup>
defineProps({ notice: { type: Object, required: true } })
</script>

<template>
  <p class="action-notice" :class="{ 'is-empty': !notice.text }" role="status" aria-live="polite" aria-atomic="true">
    <span v-if="notice.text" :key="notice.revision">{{ notice.text }}</span>
  </p>
</template>
