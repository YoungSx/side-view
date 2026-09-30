import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// WXT configuration — https://wxt.dev/api/config.html
// Everything lives under src/ (srcDir). WXT's auto-imports stay enabled because they generate the
// `#imports` virtual module and its type declarations; even so, modules import WXT helpers
// explicitly from '#imports' so the codebase stays greppable rather than leaning on injected globals.
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  manifest: {
    name: '__MSG_extName__',
    default_locale: 'en',
    description: '__MSG_extDescription__',
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png',
    },
    permissions: ['storage', 'declarativeNetRequestWithHostAccess'],
    host_permissions: [
      '*://x.com/*',
      '*://twitter.com/*',
      'https://bsky.app/*',
      'https://*.threads.com/*',
      'https://*.threads.net/*',
    ],
    // X needs narrowly scoped sub-frame header relaxation. Bluesky permits same-origin
    // frames, so its host permission does not add or broaden these network rules.
    declarative_net_request: {
      rule_resources: [
        {
          id: 'frame-headers',
          enabled: true,
          path: 'rules/frame-headers.json',
        },
      ],
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
