<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login, safeNext } from '../stores/session.js'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')

async function submit() {
  if (submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await login(email.value.trim(), password.value)
    router.replace(safeNext(route.query.next))
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="auth-card">
    <h1 class="auth-card__title">로그인</h1>
    <p class="auth-card__desc">BugLab Shop 계정으로 로그인하세요.</p>

    <form class="form" novalidate @submit.prevent="submit">
      <label class="field">
        <span class="field__label">이메일</span>
        <input v-model="email" data-testid="login-email" type="email" name="email" autocomplete="username" required />
      </label>
      <label class="field">
        <span class="field__label">비밀번호</span>
        <input
          v-model="password"
          data-testid="login-password"
          type="password"
          name="password"
          autocomplete="current-password"
          required
        />
      </label>

      <p v-if="errorMessage" class="notice notice--error" data-testid="login-error" role="alert">{{ errorMessage }}</p>

      <button data-testid="login-submit" class="btn btn--primary btn--xl" type="submit" :disabled="submitting" :aria-busy="submitting">
        로그인
      </button>
    </form>

    <p class="auth-card__switch">
      아직 회원이 아니신가요?
      <RouterLink :to="{ path: '/signup', query: route.query }">회원가입</RouterLink>
    </p>
  </section>
</template>
