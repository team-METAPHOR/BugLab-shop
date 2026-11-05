<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { safeNext, signup } from '../stores/session.js'
import AuthShell from '../components/AuthShell.vue'

const route = useRoute()
const router = useRouter()
const name = ref('')
const email = ref('')
const password = ref('')
const reportConsent = ref(false)
const submitting = ref(false)
const errorMessage = ref('')

async function submit() {
  if (submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await signup(name.value.trim(), email.value.trim(), password.value, reportConsent.value)
    router.replace(safeNext(route.query.next))
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthShell>
    <div class="auth-card">
      <h1 class="auth-card__title">회원가입</h1>
      <p class="auth-card__desc">데모용 가상 쇼핑몰입니다. 실제 개인정보를 입력하지 마세요.</p>

      <form class="form" novalidate @submit.prevent="submit">
        <label class="field">
          <span class="field__label">이름</span>
          <input v-model="name" data-testid="signup-name" type="text" name="name" autocomplete="nickname" maxlength="30" required />
        </label>
        <label class="field">
          <span class="field__label">이메일</span>
          <input v-model="email" data-testid="signup-email" type="email" name="email" autocomplete="username" required />
        </label>
        <label class="field">
          <span class="field__label">비밀번호 (8자 이상)</span>
          <input
            v-model="password"
            data-testid="signup-password"
            type="password"
            name="password"
            autocomplete="new-password"
            minlength="8"
            required
          />
        </label>

        <label class="consent">
          <input v-model="reportConsent" data-testid="signup-report-consent" type="checkbox" name="reportConsent" />
          <span>
            (선택) 버그 신고 시 브라우저 환경 정보와 민감한 정보를 가린 화면 캡처 전송에 동의합니다.
            동의하면 신고할 때마다 다시 묻지 않습니다.
          </span>
        </label>

        <p v-if="errorMessage" class="notice notice--error" data-testid="signup-error" role="alert">{{ errorMessage }}</p>

        <button data-testid="signup-submit" class="btn btn--primary btn--xl" type="submit" :disabled="submitting" :aria-busy="submitting">
          가입하기
        </button>
      </form>

      <p class="auth-card__switch">
        이미 계정이 있으신가요?
        <RouterLink :to="{ path: '/login', query: route.query }">로그인</RouterLink>
      </p>
    </div>
  </AuthShell>
</template>
