import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 3000,
  },
});
