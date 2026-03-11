import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const proxyTarget =
    process.env.VITE_PROXY_TARGET || process.env.VITE_API_URL || 'http://127.0.0.1:20999'

  return {
    base: '/ui/',
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
      minify: false,
      reportCompressedSize: false,
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'next/navigation': resolve(__dirname, 'src/compat/next-navigation.ts'),
        'next/link': resolve(__dirname, 'src/compat/next-link.tsx'),
        'next/dynamic': resolve(__dirname, 'src/compat/next-dynamic.tsx'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 21888,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/assets': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
