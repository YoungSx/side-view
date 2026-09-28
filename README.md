# side-view

A Chrome (MV3) browser extension that opens a tweet's detail **in a column beside the timeline**
instead of navigating away — reviving the multi-column reading experience of an older Twitter web
client. Built on a platform-agnostic core so X, BlueSky, and Threads are pluggable adapters.

> **Status:** Phase 1 — X / Twitter only, `replace-sidebar` layout mode.

## How it works

1. A zero-dependency content script watches the home timeline and intercepts tweet clicks in the
   capture phase, cancelling X's client-side (SPA) navigation.
2. The clicked tweet's canonical `/{handle}/status/{id}` URL is loaded into a **same-origin
   `<iframe>`** hosted in a Shadow-DOM column mounted next to the timeline. The iframe reuses X's
   own renderer and your logged-in session, so threads, media, polls and replies render natively.
3. A second content script runs *inside* that iframe (gated by `window.name`) and strips X's own
   nav/sidebar so only the detail thread shows.

The core engine talks only to three interfaces — `PlatformAdapter`, `DetailColumnProvider`,
`LayoutController` — so new platforms, a future GraphQL renderer, or the reserved `insert-column`
layout mode slot in without touching the interception logic.

## Develop

```bash
pnpm install          # runs `wxt prepare`
pnpm dev              # dev build + HMR (Chrome)
pnpm build            # production build -> .output/chrome-mv3
pnpm compile          # tsc --noEmit
pnpm check            # biome format + lint (writes)
pnpm test             # vitest
```

Load `.output/chrome-mv3` as an unpacked extension at `chrome://extensions`.

## Runtime verification checklist

Selectors and the framing/CSP conclusion are derived from X's historically-stable DOM but **must be
confirmed against a live, logged-in x.com tab** — see `VERIFICATION.md`.
