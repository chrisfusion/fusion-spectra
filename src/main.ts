import { createApp } from 'vue'
import { Quasar, Notify } from 'quasar'
import { createPinia } from 'pinia'
import '@quasar/extras/mdi-v7/mdi-v7.css'
import 'quasar/src/css/index.sass'
import './css/app.scss'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(Quasar, {
  plugins: { Notify },
})
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Apply persisted theme before first paint
import('@/stores/theme').then(({ useThemeStore }) => useThemeStore(pinia))

app.mount('#app')
