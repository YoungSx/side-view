# Runtime verification checklist

Verified on 2026-09-29 in native Windows Chrome 154.0.8037.58 with an authenticated X
profile and the unpacked production build. Real UI clicks opened a tweet, switched to another,
closed the detail, and reopened it while the top-level URL stayed `https://x.com/home`.
The detail frame rendered the native thread with X's navigation hidden. Tests also cover late
anchors, removed hosts, atomic anchor replacement, and invalidation cleanup.

The fixes address missing host recovery, WXT's important host reset overriding flex sizing,
X's cached Service Worker HTML bypassing header rules, and Chrome clearing `window.name`.
Other options, narrow viewport behavior, and the full interaction matrix below remain separate
checks; the observed success is not a claim that every checklist item was exercised.

## On-demand detail lifecycle

Startup only prepares the detached shadow UI and installs routing/settings listeners. It does
not insert a detail host, iframe, or detail layout stylesheet. `IframeColumn` requires a non-null
intent: there is no empty-view branch or placeholder in the shipped component.

Eligible clicks stage the intent, synchronously mount the layout, and only then cancel native
navigation. Unavailable/mount-failure paths roll back and leave the click to X. Closed views stay
closed across DOM replacement, route notifications, and settings changes. The DOM observer runs
only while the detail is open. Context invalidation during preparation cannot resurrect UI.

The frame has loading, ready and error states. Blocked documents and a 20-second load timeout show
an error with a canonical open-in-new-tab link, instead of a permanent spinner. Switching targets
clears the previous state; closing destroys the iframe and cancels its timer. Native Chrome was
used to verify initial page, open, switch, close and reopen; failure/timeout/race cases are covered
by component and integration tests rather than a claim of forced live network failure.

Compact left navigation is an independent saved preference. It applies live and survives closing
the detail; switching it off restores X's navigation. It is off by default.

## Close and responsive layout verification

Closing removes the detail host and layout stylesheet, restores the native right sidebar,
and keeps the column closed through DOM/route updates. An eligible tweet click reopens it.
The primary column retains X's native width and cannot shrink to accommodate the detail.
The detail width is the smaller of the configured width and the viewport space to its right;
window resize recalculates it. The configured column width therefore acts as a maximum.

Native Chrome measurements with DevTools docked (CSS pixels):

| State | Left navigation x / width | Timeline x / width | Detail width | Viewport / page width |
| --- | --- | --- | --- | --- |
| Open | 0 / 381.7 | 381.7 / 600 | 496.3 | 1478 / 1478 |
| Closed | 0 / 381.7 | 381.7 / 600 | No host | 1478 / 1478 |

Closed-state inspection also confirmed no `sv-active` class and no `sv-layout-style` node.
Unit coverage includes resize from 500px available space to 300px and back to the 600px cap,
and rejects reopening on ordinary/profile/modifier clicks excluded by policy.

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

The static `frame-headers` ruleset is enabled by the manifest and strips frame-blocking response
headers only for the scoped sub-frame requests in `public/rules/frame-headers.json`.

X's authenticated Service Worker can return cached HTML containing `X-Frame-Options: deny`.
Chrome's DNR cannot modify Service Worker-generated / CacheStorage responses
([Chrome documentation](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)).
The X adapter adds the current page's `lang` parameter only to the iframe URL. X's navigation
handler skips cached HTML when that parameter is present, so the network header rule can run.
Canonical links remain unchanged. This was confirmed against X's live worker and in Chrome;
recheck that platform behavior if framing regresses.

## 4. Chrome-stripping inside the frame

The framed thread should show **without** X's left nav / right sidebar / compose button
(`src/platforms/x/detail-frame-css.ts`, injected by `x-detail-frame.content.ts`, gated on
the iframe element name `sideview-detail`, with `window.name` as fallback). If X's chrome still shows, those selectors need updating.
Watch for **frame-busting**: if the frame reloads the top page or logs you out, X ships
`top !== self` defense — file an issue; it needs an in-frame guard.

## 5. Survives SPA navigation

Scroll (virtualized cells recycle) and navigate around (click a profile natively, use back/forward).
The detail column must re-attach after X rebuilds the timeline column (host/anchor DOM reconciliation + the
route-observer guard). If it disappears after navigation, the Navigation API / history-bridge
signal may not be firing — check for `sv:locationchange` events in the console.

## 6. Options

`chrome://extensions` → side-view → **Details → Extension options**. Toggles apply live to open
tabs (layout mode, width, profile/hashtag interception); **Enabled** requires a reload.

---

**Not yet implemented (phase 1 scope):** BlueSky/Threads adapters, the functional `insert-column`
layout (the mode + CSS exist; verify placement when enabled), and a drag-to-resize handle (width is
set via Options). See `README.md` for architecture.
