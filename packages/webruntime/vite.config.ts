import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/browser',
  build: {
    outDir: '../../dist/browser-shell',
    emptyOutDir: true
  }
});
