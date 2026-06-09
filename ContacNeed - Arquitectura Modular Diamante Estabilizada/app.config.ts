import { defineConfig } from '@tanstack/react-start/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  tsr: {
    appDirectory: 'src',
  },
  vite: {
    plugins: () => [tailwindcss()],
  },
  server: {
    preset: 'netlify',
  },
})
