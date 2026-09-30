import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest wires WXT's Vite config (aliases like `@/*` and the `#imports` module, `fakeBrowser`),
// so tests import project modules exactly as the source does. DOM tests run under jsdom pinned to
// an x.com origin so `location.origin`-based URL normalisation behaves like the real page.
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://x.com/home' } },
    setupFiles: ['./src/test-utils/setup.ts', './src/test-utils/i18n.ts'],
  },
});
