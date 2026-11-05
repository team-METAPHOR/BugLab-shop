<script setup>
// 외부 아이콘 폰트·CDN을 쓰지 않기 위해 필요한 아이콘만 인라인 SVG로 둔다.
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 24 },
})
</script>

<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'search'">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </template>
    <template v-else-if="name === 'menu'">
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="M6 6l12 12M18 6 6 18" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.2-3.7 4-5.5 7.5-5.5s6.3 1.8 7.5 5.5" />
    </template>
    <template v-else-if="name === 'heart'">
      <path d="M20.5 5.5a5.2 5.2 0 0 0-7.4 0L12 6.6l-1.1-1.1a5.2 5.2 0 0 0-7.4 7.4L12 21l8.5-8.1a5.2 5.2 0 0 0 0-7.4Z" />
    </template>
    <template v-else-if="name === 'cart'">
      <path d="M2.5 4h2.2l2.4 11.1a1.8 1.8 0 0 0 1.8 1.4h8.4a1.8 1.8 0 0 0 1.7-1.3L21 8H6" />
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="17.5" cy="20" r="1.3" />
    </template>
    <template v-else-if="name === 'truck'">
      <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3.2v2.8h-7" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </template>
    <template v-else-if="name === 'return'">
      <path d="M4 9h11a5 5 0 0 1 0 10H9" />
      <path d="m7.5 5.5-3.5 3.5 3.5 3.5" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </template>
    <template v-else-if="name === 'chevron-left'">
      <path d="m14.5 6-6 6 6 6" />
    </template>
    <template v-else-if="name === 'chevron-right'">
      <path d="m9.5 6 6 6-6 6" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="m6 9.5 6 6 6-6" />
    </template>
    <template v-else-if="name === 'arrow-up'">
      <path d="M12 19.5v-15M6 10.5l6-6 6 6" />
    </template>
    <template v-else-if="name === 'arrow-right'">
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </template>
    <template v-else-if="name === 'pause'">
      <path d="M9 6v12M15 6v12" />
    </template>
    <template v-else-if="name === 'play'">
      <path d="M8 5.5v13l10.5-6.5z" />
    </template>
    <template v-else-if="name === 'grid'">
      <rect x="4" y="4" width="13" height="13" rx="1.5" />
      <path d="M20 7.5V20H7.5" />
    </template>
    <template v-else-if="name === 'ticket'">
      <path d="M3.5 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4V18h17v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6h-17z" />
      <path d="M14 6.5v11" stroke-dasharray="2 2" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
    </template>
    <template v-else-if="name === 'shield'">
      <path d="M12 3.5 19 6v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </template>
    <template v-else-if="name === 'spark'">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </template>
    <template v-else-if="name === 'box'">
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </template>
  </svg>
</template>
