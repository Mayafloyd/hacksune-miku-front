import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const backendProxy = {
  target: 'http://127.0.0.1:8000',
  changeOrigin: true,
};

export default defineConfig({
  integrations: [react()],
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/api': backendProxy,
      },
    },
    preview: {
      proxy: {
        '/api': backendProxy,
      },
    },
  },
});
