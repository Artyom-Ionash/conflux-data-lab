import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Эмуляция __dirname для ESM модулей (.mts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(), // Оставляем как фоллбэк
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  resolve: {
    alias: {
      // Явное указание: @ -> корень проекта
      '@': resolve(__dirname, './'),
    },
  },
});