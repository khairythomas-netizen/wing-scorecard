import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages serves this repo from /wing-scorecard/.
// BASE_PATH lets a custom domain or local preview override it.
const base = process.env.BASE_PATH ?? '/wing-scorecard/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: { outDir: 'dist', sourcemap: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
