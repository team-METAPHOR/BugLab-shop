<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  slides: { type: Array, required: true },
})
const emit = defineEmits(['scroll-to-catalog'])

// 슬라이드 위치는 현재 슬라이드 기준 offset(-2 ~ N-3)으로 계산한다.
// 화면에는 -1(왼쪽 미리보기), 0·1(본문), 2(오른쪽 미리보기)만 보인다.
// 한쪽 끝에서 반대쪽 끝으로 넘어가는 슬라이드는 화면 밖이므로 전환 애니메이션 없이 순간 이동한다.
const count = computed(() => props.slides.length)
const active = ref(0)
const jumping = ref(new Set())
const userPaused = ref(false)
const hoverPaused = ref(false)
const pageHidden = ref(false)
const reducedMotion = ref(false)
const gridOpen = ref(false)
const gridClose = ref(null)
const gridButton = ref(null)

const DURATION = 5000
const autoplay = computed(() => !reducedMotion.value && count.value > 1)
const running = computed(() => autoplay.value && !userPaused.value && !hoverPaused.value && !pageHidden.value && !gridOpen.value)

// 자동 넘김 시계. 진행선은 같은 시간(5초)으로 그리기만 하고, 넘김은 이 타이머가 한다(진행선이 숨겨진 모바일에서도 동작).
let timer = null
let remaining = DURATION
let startedAt = 0
function schedule() {
  clearTimeout(timer)
  timer = null
  if (!running.value) return
  startedAt = performance.now()
  timer = setTimeout(() => {
    timer = null
    next()
  }, remaining)
}
function pauseClock() {
  if (!timer) return
  clearTimeout(timer)
  timer = null
  remaining = Math.max(0, remaining - (performance.now() - startedAt))
}

function offsetOf(index, current = active.value) {
  const n = count.value
  return ((index - current + n + 2) % n) - 2
}

function goTo(next) {
  const n = count.value
  const target = ((next % n) + n) % n
  if (target === active.value) return
  const jumps = new Set()
  props.slides.forEach((_, i) => {
    if (Math.abs(offsetOf(i, target) - offsetOf(i)) > 1) jumps.add(i)
  })
  jumping.value = jumps
  active.value = target
}

const prev = () => goTo(active.value - 1)
const next = () => goTo(active.value + 1)

function slideStyle(index) {
  return { '--o': offsetOf(index), transition: jumping.value.has(index) ? 'none' : undefined }
}

function isVisible(index) {
  const o = offsetOf(index)
  return o === 0 || o === 1
}

const counter = computed(() => String(active.value + 1).padStart(2, '0'))
const total = computed(() => String(count.value).padStart(2, '0'))

// 스와이프(터치·펜). 마우스 드래그는 링크 클릭과 겹치지 않게 다루지 않는다.
let startX = null
function onPointerDown(event) {
  if (event.pointerType === 'mouse') return
  startX = event.clientX
}
function onPointerUp(event) {
  if (startX === null) return
  const dx = event.clientX - startX
  startX = null
  if (Math.abs(dx) > 48) (dx < 0 ? next : prev)()
}

function linkAttrs(slide) {
  return slide.to ? { to: slide.to } : { href: '#catalog' }
}

function onSlideClick(slide, event) {
  if (slide.to) return
  event.preventDefault()
  emit('scroll-to-catalog')
}

async function openGrid() {
  gridOpen.value = true
  document.body.style.overflow = 'hidden'
  await nextTick()
  gridClose.value?.focus()
}

function closeGrid() {
  if (!gridOpen.value) return
  gridOpen.value = false
  document.body.style.overflow = ''
  gridButton.value?.focus()
}

function pickFromGrid(index, slide, event) {
  goTo(index)
  closeGrid()
  if (!slide.to) {
    event.preventDefault()
    emit('scroll-to-catalog')
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') closeGrid()
}

function onVisibility() {
  pageHidden.value = document.hidden
}

let motionQuery = null
function onMotionChange() {
  reducedMotion.value = motionQuery.matches
}

watch(running, (value) => (value ? schedule() : pauseClock()))
watch(active, () => {
  remaining = DURATION
  schedule()
})

// 모달이 열려 있는 동안 배경(#app)을 inert로 만들어 포커스가 빠져나가지 않게 한다.
watch(gridOpen, (open) => {
  const app = document.getElementById('app')
  if (app) app.inert = open
  if (open) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  onMotionChange()
  motionQuery.addEventListener('change', onMotionChange)
  document.addEventListener('visibilitychange', onVisibility)
  schedule()
})

onBeforeUnmount(() => {
  motionQuery?.removeEventListener('change', onMotionChange)
  document.removeEventListener('visibilitychange', onVisibility)
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  clearTimeout(timer)
  const app = document.getElementById('app')
  if (app) app.inert = false
})
</script>

<template>
  <section
    class="hero-carousel"
    aria-roledescription="carousel"
    aria-label="기획전 배너"
    @mouseenter="hoverPaused = true"
    @mouseleave="hoverPaused = false"
    @focusin="hoverPaused = true"
    @focusout="hoverPaused = false"
  >
    <div class="hero-carousel__stage" @pointerdown="onPointerDown" @pointerup="onPointerUp" @pointercancel="startX = null">
      <div
        v-for="(slide, index) in slides"
        :key="slide.id"
        :class="['hero-slide', `hero-slide--${slide.tone}`, { 'is-peek': !isVisible(index), 'has-coupon': slide.coupon }]"
        :style="slideStyle(index)"
        role="group"
        aria-roledescription="slide"
        :aria-label="`${index + 1} / ${slides.length}`"
        :aria-hidden="isVisible(index) ? undefined : 'true'"
      >
        <component
          :is="slide.to ? 'RouterLink' : 'a'"
          v-bind="linkAttrs(slide)"
          class="hero-slide__link"
          :tabindex="isVisible(index) ? undefined : -1"
          draggable="false"
          @click="onSlideClick(slide, $event)"
        >
          <span class="hero-slide__bg" :style="{ background: slide.bg }" aria-hidden="true" />
          <img v-if="slide.image" class="hero-slide__image" :src="slide.image" alt="" width="1000" height="750" draggable="false" />
          <span v-if="slide.coupon" class="hero-ticket" aria-hidden="true">
            <span class="hero-ticket__label">COUPON</span>
            <span class="hero-ticket__amount">5,000<small>원</small></span>
            <span class="hero-ticket__code">SAVE5000</span>
          </span>
          <span class="hero-slide__content">
            <span class="hero-slide__eyebrow">{{ slide.eyebrow }}</span>
            <span class="hero-slide__title">
              <span v-for="line in slide.title" :key="line">{{ line }}</span>
            </span>
            <span class="hero-slide__text">{{ slide.text }}</span>
          </span>
        </component>
      </div>
    </div>

    <div class="hero-carousel__controls">
      <div class="hero-progress" aria-hidden="true">
        <span
          class="hero-progress__segment"
          :style="{ width: `${100 / slides.length}%`, transform: `translateX(${active * 100}%)` }"
        >
          <span
            v-if="autoplay"
            :key="active"
            :class="['hero-progress__fill', { 'is-paused': !running }]"
          />
          <span v-else class="hero-progress__fill hero-progress__fill--static" />
        </span>
      </div>

      <div class="hero-pager">
        <button class="hero-pager__btn" type="button" aria-label="이전 배너" @click="prev">
          <AppIcon name="chevron-left" :size="20" />
        </button>
        <p class="hero-pager__count" aria-live="polite">
          <strong>{{ counter }}</strong><span aria-hidden="true" class="hero-pager__sep" /><span class="sr-only"> / </span>{{ total }}
        </p>
        <button class="hero-pager__btn" type="button" aria-label="다음 배너" @click="next">
          <AppIcon name="chevron-right" :size="20" />
        </button>
      </div>
      <button ref="gridButton" class="hero-round-btn" type="button" aria-label="배너 전체 보기" @click="openGrid">
        <AppIcon name="grid" :size="20" />
      </button>
      <button
        v-if="autoplay"
        class="hero-round-btn"
        type="button"
        :aria-label="userPaused ? '배너 자동 넘김 시작' : '배너 자동 넘김 멈춤'"
        :aria-pressed="userPaused"
        @click="userPaused = !userPaused"
      >
        <AppIcon :name="userPaused ? 'play' : 'pause'" :size="20" />
      </button>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="gridOpen" class="modal" role="dialog" aria-modal="true" aria-labelledby="banner-grid-title" @click.self="closeGrid">
          <div class="modal__panel">
            <div class="modal__head">
              <h2 id="banner-grid-title" class="modal__title">진행 중인 기획전 <span>{{ slides.length }}</span></h2>
              <button ref="gridClose" class="modal__close" type="button" aria-label="닫기" @click="closeGrid">
                <AppIcon name="close" :size="22" />
              </button>
            </div>
            <ul class="banner-grid">
              <li v-for="(slide, index) in slides" :key="slide.id">
                <component
                  :is="slide.to ? 'RouterLink' : 'a'"
                  v-bind="linkAttrs(slide)"
                  :class="['banner-grid__item', `hero-slide--${slide.tone}`, { 'is-current': index === active }]"
                  @click="pickFromGrid(index, slide, $event)"
                >
                  <span class="hero-slide__bg" :style="{ background: slide.bg }" aria-hidden="true" />
                  <img v-if="slide.image" class="hero-slide__image" :src="slide.image" alt="" width="1000" height="750" />
                  <span class="banner-grid__text">
                    <small>{{ slide.eyebrow }}</small>
                    <strong>{{ slide.title.join(' ') }}</strong>
                  </span>
                </component>
              </li>
            </ul>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>
