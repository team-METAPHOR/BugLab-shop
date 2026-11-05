import { createRouter, createWebHistory } from 'vue-router'
import { ensureSessionLoaded, session } from './stores/session.js'
import HomeView from './views/HomeView.vue'
import ProductDetailView from './views/ProductDetailView.vue'
import LoginView from './views/LoginView.vue'
import SignupView from './views/SignupView.vue'
import CartView from './views/CartView.vue'
import NotFoundView from './views/NotFoundView.vue'
import CreditsView from './views/CreditsView.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/products/:id', name: 'product', component: ProductDetailView },
  { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
  { path: '/signup', name: 'signup', component: SignupView, meta: { guestOnly: true } },
  { path: '/cart', name: 'cart', component: CartView, meta: { requiresAuth: true } },
  { path: '/credits', name: 'credits', component: CreditsView },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  await ensureSessionLoaded()
  if (to.meta.requiresAuth && !session.user) {
    return { path: '/login', query: { next: to.fullPath } }
  }
  if (to.meta.guestOnly && session.user) {
    return { path: '/' }
  }
  return true
})
