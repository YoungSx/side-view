import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// WXT configuration — https://wxt.dev/api/config.html
// Everything lives under src/ (srcDir). WXT's auto-imports stay enabled because they generate the
// `#imports` virtual module and its type declarations; even so, modules import WXT helpers
// explicitly from '#imports' so the codebase stays greppable rather than leaning on injected globals.
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'side-view',
    description: 'Open X (Twitter) tweet detail in a side column instead of navigating away.',
    permissions: ['storage', 'declarativeNetRequestWithHostAccess'],
    host_permissions: ['*://x.com/*', '*://twitter.com/*'],
    // Header-relaxation ruleset, ENABLED at load. Live testing on x.com confirmed the detail
    // document is served with `X-Frame-Options: deny` (no `frame-ancestors` to make Chrome ignore
    // it), so removing those headers is REQUIRED for the same-origin iframe to render — not an
    // optional fallback. Enabling it in the manifest makes it active the moment the extension loads,
    // independent of the (sleep-prone) service-worker + storage + watch chain. The `bypassFrameHeaders`
    // setting can still turn it off at runtime; it defaults to on so the two never disagree.
    // The rule is tightly scoped (sub_frame + initiator x.com/twitter.com) so it only relaxes the
    // framed detail document, never the top-level app.
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
