import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/admin': 'http://localhost:3000',
      '/signup': 'http://localhost:3000',
      '/signin': 'http://localhost:3000',
      '/logout': 'http://localhost:3000',
      '/loadMorePosts': 'http://localhost:3000',
      '/createPost': 'http://localhost:3000',
      '/vote': 'http://localhost:3000',
      '/comment': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
})
