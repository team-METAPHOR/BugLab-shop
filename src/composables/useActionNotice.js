import { reactive } from 'vue'

// 같은 동작을 반복해도 이번 요청의 확인 문구를 새로 알린다.
export function useActionNotice() {
  const notice = reactive({ text: '', revision: 0 })
  function announce(text) {
    notice.text = text
    notice.revision += 1
  }
  function clear() { notice.text = '' }
  return { notice, announce, clear }
}
