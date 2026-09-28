# Runtime verification checklist

The extension **builds, type-checks, lints, and unit-tests green**, but the parts that depend on
x.com's live DOM and HTTP headers could not be verified in the build environment (no network access
to x.com). Do these checks once in a real, logged-in Chrome before relying on it. Each has a
built-in fallback so a failure degrades gracefully rather than breaking the page.

## 0. Load it

```bash
pnpm install && pnpm build
```

`chrome://extensions` → enable Developer mode → **Load unpacked** → select `.output/chrome-mv3`.
Open `https://x.com/home` (logged in).

## 1. Selectors resolve (DOM-drift canary)

Open DevTools console on x.com. On load the content script logs
`[side-view] selector self-check { primaryColumn: true, sidebarColumn: true, tweet: true, … }`.
Any `false` means X renamed that hook — patch it under **Options → Advanced: selector overrides**
(e.g. `{ "primaryColumn": "…new selector…" }`) without waiting for a code change. All selectors
live in `src/platforms/x/selectors.ts`.

## 2. Core interaction

Click a tweet **body** in the home timeline. Expect: no navigation; a detail column appears where
the right sidebar was, showing that tweet's thread. Clicking reply/like/media, or ⌘/Ctrl-click,
must still behave natively. X's keyboard shortcuts (`j`/`k`/`.`) must still work — the click
listener is click-only and the shadow root isolates its own key events.

## 3. Same-origin framing (the load-bearing assumption)

If the detail column renders the thread, framing works with **no** header changes — done. If it
stays **blank**, X is blocking the frame (`X-Frame-Options` / CSP). Turn on **Options → Bypass
frame headers**; the background worker enables the scoped `declarativeNetRequest` ruleset
(`public/rules/frame-headers.json`, sub_frame + initiator x.com only) that strips `X-Frame-Options`.
Reload. Still blank? In DevTools → Network, open the `/{handle}/status/{id}` document request and read
its response `content-security-policy` — if `frame-ancestors` is stricter than `'self'`, add a
second `responseHeaders` entry removing `content-security-policy` to that ruleset.

## 4. Chrome-stripping inside the frame

The framed thread should show **without** X's left nav / right sidebar / compose button
(`src/platforms/x/detail-frame-css.ts`, injected by `x-detail-frame.content.ts`, gated on
`window.name === "sideview-detail"`). If X's chrome still shows, those selectors need updating.
Watch for **frame-busting**: if the frame reloads the top page or logs you out, X ships
`top !== self` defense — file an issue; it needs an in-frame guard.

## 5. Survives SPA navigation

Scroll (virtualized cells recycle) and navigate around (click a profile natively, use back/forward).
The detail column must re-attach after X rebuilds the timeline column (`autoMount` + the
route-observer guard). If it disappears after navigation, the Navigation API / history-bridge
signal may not be firing — check for `sv:locationchange` events in the console.

## 6. Options

`chrome://extensions` → side-view → **Details → Extension options**. Toggles apply live to open
tabs (layout mode, width, profile/hashtag interception); **Enabled** requires a reload.

---

**Not yet implemented (phase 1 scope):** BlueSky/Threads adapters, the functional `insert-column`
layout (the mode + CSS exist; verify placement when enabled), and a drag-to-resize handle (width is
set via Options). See `README.md` for architecture.
