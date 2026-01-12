import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    sourcemap: true
  },
  server: {
    port: 3000,
    open: true
  }
});
