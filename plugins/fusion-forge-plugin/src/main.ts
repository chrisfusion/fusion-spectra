// Standalone dev entry point — not loaded when running as MFE remote inside the shell.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { Quasar } from 'quasar'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import App from './App.vue'
import { useAuthStore } from './stores/auth'
import VenvsView from './views/VenvsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',             redirect: '/forge/venvs' },
    { path: '/forge/venvs', component: VenvsView },
  ],
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(Quasar, { plugins: {} })

// Bypass auth for standalone dev — mirrors the shell's bypass mode
const auth = useAuthStore()
auth.setUser({
  sub: 'dev-user',
  name: 'Dev User',
  email: 'dev@fusion.local',
  preferred_username: 'dev',
  accessToken: 'dev-bypass-token',
})

app.mount('#app')
