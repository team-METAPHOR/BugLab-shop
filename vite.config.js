import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 코드 작성용 개발 서버(5173). Playwright 대상은 빌드본을 서빙하는 백엔드(3100/3200)다.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3100',
    },
  },
})
