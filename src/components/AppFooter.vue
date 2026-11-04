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
      <p>© 2026 BugLab Shop. 데모용 가상 쇼핑몰이며 실제 결제가 이루어지지 않습니다.</p>
      <small v-if="envLabel" class="env-label" data-testid="app-env">{{ envLabel }}</small>
    </div>
  </footer>
</template>
