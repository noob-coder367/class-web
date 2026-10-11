import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Cho phép import dữ liệu dùng chung ở ../shared (từ điển Nối Từ) trong dev server.
  server: { fs: { allow: ['..'] } },
})
