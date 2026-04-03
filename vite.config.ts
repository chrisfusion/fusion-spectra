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
      name: 'fusion-spectra',
      remotes: {
        // Plugin remotes are registered here as they are added.
        // Example:
        // 'fusion-jobs-ui': 'http://localhost:3001/assets/remoteEntry.js',
      },
      shared: ['vue', 'pinia', 'vue-router'],
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    // Required by @originjs/vite-plugin-federation
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
})
