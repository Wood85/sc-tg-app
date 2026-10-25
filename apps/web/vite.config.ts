import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Mini App в разработке открывается через туннель cloudflared.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
