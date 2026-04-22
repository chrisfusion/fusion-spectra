import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    quasar({
      sassVariables: resolve(__dirname, 'src/css/quasar-variables.scss')
    })
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: ['dev.fusion.local']
  },
  build: {
    target: 'esnext'
  }
})
