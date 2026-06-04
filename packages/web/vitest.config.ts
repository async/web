import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/**/*.test.ts'
    ]
  },
  resolve: {
    alias: [
      {
        find: /^@async\/router$/,
        replacement: new URL('../router/src/index.ts', import.meta.url).pathname
      },
      {
        find: /^@async\/webruntime$/,
        replacement: new URL('../webruntime/src/index.ts', import.meta.url).pathname
      },
      {
        find: /^@async\/webruntime\/vite$/,
        replacement: new URL('../webruntime/src/vite/index.ts', import.meta.url).pathname
      },
      {
        find: /^@async\/webruntime\/(.*)$/,
        replacement: new URL('../webruntime/src/$1', import.meta.url).pathname
      }
    ]
  }
});
