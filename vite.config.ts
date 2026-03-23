import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom')) return 'vendor-react'
          if (id.includes('node_modules/react/')) return 'vendor-react'
          if (id.includes('node_modules/react-router')) return 'vendor-react'
          if (id.includes('node_modules/@clerk')) return 'vendor-clerk'
          if (id.includes('node_modules/dexie')) return 'vendor-dexie'
          if (id.includes('node_modules/katex')) return 'vendor-katex'
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) return 'vendor-i18n'
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark-') || id.includes('node_modules/rehype-')) return 'vendor-markdown'
          if (id.includes('node_modules/@xyflow')) return 'vendor-xyflow'
          if (id.includes('node_modules/posthog-js')) return 'vendor-posthog'
          if (id.includes('node_modules/@stripe')) return 'vendor-stripe'
          if (id.includes('node_modules/codemirror') || id.includes('node_modules/@codemirror')) return 'vendor-codemirror'
        },
      },
    },
  },
})
