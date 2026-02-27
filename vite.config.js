import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
  plugins: [svelte()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'dashboard') return 'dashboard.js'
          return 'app.js'
        },
        assetFileNames: 'app.[ext]'
      }
    }
  }
})