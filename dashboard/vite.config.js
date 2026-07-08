import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  envDir: resolve(import.meta.dirname, '..'),
  server: {
    port: 5180,
  },
  preview: {
    port: 5180,
  },
});
