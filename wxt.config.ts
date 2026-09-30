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
    // This is the public title on the Chrome Web Store listing (45-char manifest limit), so it
    // names the platform and the payoff rather than the internal project slug. Everything else
    // that reads "side-view" is an internal identifier (window.name gate, CSS class, log prefix)
    // and must keep that spelling.
    name: 'Side View for X (Twitter)',
    description:
      'Read a tweet’s thread in a side column instead of losing your place in the timeline.',
    permissions: ['storage', 'declarativeNetRequestWithHostAccess'],
    host_permissions: ['*://x.com/*', '*://twitter.com/*'],
    // Header-relaxation ruleset, ENABLED at load. Live testing on x.com confirmed the detail
    // document is served with `X-Frame-Options: deny` (no `frame-ancestors` to make Chrome ignore
    // it), so removing those headers is REQUIRED for the same-origin iframe to render — not an
    // optional fallback. Enabling it in the manifest makes it active the moment the extension loads,
    // independent of the (sleep-prone) service-worker + storage + watch chain. There is deliberately
    // no runtime toggle — one would need a background worker calling `updateEnabledRulesets`, and the
    // framing never renders with the rule off.
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
