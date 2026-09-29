# side-view

A Chrome (MV3) browser extension that opens a post's detail **in a column beside the timeline**
instead of navigating away — reviving the multi-column reading experience of an older Twitter web
client. Built on a platform-agnostic core so X, Bluesky, and future platforms are pluggable adapters.

> **Status:** X / Twitter and Bluesky iframe adapters, plus native Threads column integration. X is verified with an authenticated session;
> Bluesky is verified on public Discover posts, with authenticated flows still to be verified.

## How it works

1. A shared content script watches the timeline and intercepts eligible post clicks in the
   capture phase, cancelling client-side navigation only after the detail column accepts the post.
2. The clicked post URL (`/{handle}/status/{id}` on X, `/profile/{actor}/post/{rkey}` on Bluesky) is loaded into a **same-origin
   `<iframe>`** hosted in a Shadow-DOM column positioned beside the timeline. X uses an inline column; Bluesky uses a fixed column without moving its independently centered feed. The iframe reuses the platform's
   own renderer and your logged-in session, so threads, media, polls and replies render natively.
3. A second content script runs *inside* that iframe (identified by the iframe element name, with `window.name` as fallback) and strips the platform's
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


## Threads

Threads uses its own saved columns, router, renderer, menus and scrolling. Side-view creates one
native detail column and reuses its server ID when another post is clicked. Remove it using the
native column menu. It persists in the Threads account until removed; disabling side-view stops
interception without deleting the saved column. No iframe, column CSS, or frame-header rules are
used on Threads. Native integration depends on a narrow, runtime-checked compatibility boundary
around the site's router and mounted column actions; unsupported site changes fall back to native
click handling. X/Bluesky layout and compact-navigation settings do not override Threads' layout.
