import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      // Покриття збираємо для модуля варіанта: сервіси та контролери каталогу.
      include: ['src/auto-parts/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/dto/**',
        'src/**/entities/**',
        'src/**/*.module.ts',
      ],
      reporter: [['text', { maxCols: 140, skipFull: false }], 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
