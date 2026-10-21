import { createApp } from 'vue'
import { Quasar, Notify, Dialog } from 'quasar'
import iconSet from 'quasar/icon-set/mdi-v7'
import { createPinia } from 'pinia'
import '@quasar/extras/mdi-v7/mdi-v7.css'
import 'quasar/src/css/index.sass'
import './css/app.scss'
import App from './App.vue'
import router from './router'

const app = createApp(App)

// Quasar's built-in icons (Notify types, select arrows, dialog/chip close, …) default to Material
// Icons, which isn't loaded — use the mdi-v7 set that is.
app.use(Quasar, {
  plugins: { Notify, Dialog },
  iconSet,
})
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Apply persisted theme before first paint
import('@/stores/theme').then(({ useThemeStore }) => useThemeStore(pinia))

app.mount('#app')
