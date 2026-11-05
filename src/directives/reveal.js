// 스크롤해서 화면에 들어올 때 부드럽게 나타나는 장식용 효과.
// 상품 목록·장바구니처럼 검증 대상 영역에는 쓰지 않는다.
// 모션 줄이기 설정이나 자동화 브라우저(전체 페이지 스크린샷은 스크롤하지 않음)에서는 바로 보이게 한다.
const skip = () =>
  typeof window === 'undefined' ||
  !('IntersectionObserver' in window) ||
  navigator.webdriver ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let observer = null
function getObserver() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-revealed')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
  }
  return observer
}

export const vReveal = {
  mounted(el, binding) {
    if (skip()) return
    el.classList.add('reveal')
    if (binding.value) el.style.setProperty('--reveal-delay', `${binding.value}ms`)
    getObserver().observe(el)
  },
  beforeUnmount(el) {
    observer?.unobserve(el)
  },
}
