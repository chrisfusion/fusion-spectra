import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Dark, Notify } from 'quasar'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import App from './App.vue'
import router from './router'
import { initAuth } from './auth'

async function bootstrap(): Promise<void> {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)
  app.use(Quasar, {
    plugins: { Dark, Notify },
    config: {
      brand: {
        primary: '#6c5ce7',
        secondary: '#00cec9',
        accent: '#fd79a8',
        dark: '#1e1e2e',
        positive: '#00b894',
        negative: '#d63031',
        info: '#0984e3',
        warning: '#e17055',
      },
    },
  })

  await initAuth()

  app.mount('#app')
}

bootstrap().catch((err: unknown) => {
  console.error('[fusion-spectra] startup failed:', err)
  document.getElementById('app')!.innerHTML =
    '<div style="padding:2rem;font-family:sans-serif;color:#d63031">' +
    '<strong>Startup error</strong><br>' +
    String(err instanceof Error ? err.message : err) +
    '</div>'
})
