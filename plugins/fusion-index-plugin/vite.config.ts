import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import federation from '@originjs/vite-plugin-federation'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    quasar({
      sassVariables: resolve(__dirname, 'src/quasar-variables.scss'),
    }),
    federation({
      name: 'fusion-index-plugin',
      filename: 'remoteEntry.js',
      exposes: {
        './TemplatesView':      './src/views/TemplatesView.vue',
        './JobsView':           './src/views/JobsView.vue',
        './TemplateDetailView': './src/views/TemplateDetailView.vue',
      },
      shared: ['vue', 'pinia', 'vue-router'],
    }),
  ],
  server: {
    port: 3001,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
})
