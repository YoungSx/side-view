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
(`src/platforms/x/detail-frame-css.ts`, injected by `detail-frame.content.ts`, gated on
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

**Not yet fully verified:** the functional `insert-column`
layout (the mode + CSS exist; verify placement when enabled), and a drag-to-resize handle (width is
set via Options). See `README.md` for architecture.


## Bluesky adapter verification (2026-09-29)

Source reference: [official social-app](https://github.com/bluesky-social/social-app/tree/f3b7f9f38e7066a5d392f82be955813ab0e4f34f), especially Layout, DesktopRightNav and PostFeedItem.
Selectors were also checked in the live production DOM. Virtual-list direct children can include
full-viewport overlays: measure only the child containing actual posts, not the first child.

Native Chrome public Discover: open and switch posts in the detail iframe while the main URL
remains `https://bsky.app/`; close restores the native sidebar. The frame displays native content
and replies without duplicating desktop navigation. No Bluesky DNR header relaxation is added.
Authenticated timelines/actions and compact authenticated navigation have not been live-verified.
Overrides use `bluesky.<key>` (for example `bluesky.primaryColumn`) so existing X overrides cannot
silently break the other platform. Public posts do not require a login; account actions remain
native and may prompt for sign-in.


## Threads native integration (2026-09-30)

Supersedes the discarded iframe / hand-built deck prototypes. The accepted behavior is a saved
native detail column, identified by its server ID, reused by updating its native root URL and
routing within it. Creation delegates to the same home-route passthrough (`newColumnID`,
`newColumnURL`) as Threads' own Add as column UI. Updating delegates to the mounted native update
callback and in-column router. The compatibility code reads only column identity and action
capabilities from the mounted React tree; it performs no manual GraphQL calls and owns no native
layout CSS or rendering. The dedicated MAIN script requires a trusted user click; an isolated
script supplies settings and persists ownership in extension local storage.

Authenticated native Chrome: created a real column, switched posts with the original feed still
present, verified native Remove column menu, removed it, and created it again. Source/reference
confirmation came from the currently loaded native module factories, including
`useBarcelonaAddColumnFromPassthroughPropsEffect`, `useBarcelonaCreateColumnMutation`,
`useBarcelonaUpdateColumnMutation`, `BarcelonaHomeColumn.react` and `BarcelonaRoutedColumn.react`.
This is an internal site interface, not a public API; changes are capability-checked and fail
back to normal navigation. No claim is made that this interface will remain stable across releases.

Final native DOM verification after page refresh and another real post click: two native
`data-deck-column` nodes (original feed plus the reused detail), zero `data-sideview-host` nodes,
zero iframes, and no `sv-layout-style`. The original feed column server ID remained unchanged.


## Native detail-header actions (2026-09-30)

X and Bluesky no longer render the extension's separate title bar. A shared lifecycle-managed
actions group is appended to the platform's native header flex row inside the same-origin frame.
Bluesky's existing thread-options slot remains before the new actions, with no absolute positioning
or native-node relocation. Only the added group and stylesheet are removed at teardown.

Icon color is sampled from the nearest native button's painted SVG path (stroke or fill), excluding
extension icons. Native DOM/style changes and system color-scheme changes resynchronize it. X and
Bluesky can therefore retain their different icon palettes. Recovery controls appear only within
the loading/error state. A missing native header does not create a
floating fallback toolbar: iframe `load` can precede the platform's async header render.

Native Chrome verified X's single Post header with native-colored open/close icons and successful
close. Bluesky showed its gray-blue thread-options icon followed by matching open/close icons;
the original thread-options menu still opened and exposed its view/sort controls. Regression tests
cover color/style changes, delayed/replaced headers, exactly-one-group mounting, cleanup, and
canonical open-link updates.


Header polish follow-up: the shadow column has no added left border, and the framed X primary
column has zero left/right border widths, leaving the original timeline's right divider as the
single boundary. Native Chrome computed measurements for X: original back button 36 x 36 CSS px,
open/close buttons both 36 x 36, all with 9999px radius. Live inspection reported outer border 0px,
frame border 0px, zero `.sv-bar` / `.sv-title` / `.sv-fallback-actions` nodes, and one native-header
actions group. Loading/error recovery now uses explicit text actions within its state panel;
there is no legacy floating icon toolbar. The action dimensions/radius/icon size are sampled from
the nearest native button rather than a fixed extension size.

## Loading-stage toolbar removal (2026-09-30)

Native Chrome over CDP, with the updated unpacked build: opened one X post and switched to
another while the top-level URL remained `https://x.com/home`. Across 1,336 samples, the
floating toolbar never appeared. Five samples captured the exact intermediate condition:
iframe document complete and visible, but native header actions not yet mounted; none had
outer recovery controls. The final post rendered with exactly one native action group and no
loading error. Component coverage also verifies a delayed header after the load event and
preserves the canonical fallback link on actual frame failure.

## Fresh post content, shared static resources (2026-09-30)

Post switches use document navigation to request post content again. The extension adds no
tweet-content cache and leaves normal browser caching of static assets enabled.
CDP verified A -> B -> A after reloading the production extension: all three navigations had
distinct performance.timeOrigin values and each requested TweetDetail from the network with
its original no-store response policy. Script cache hits were 99/100, 107/108 and 96/97.
The stale-document visibility guard, loading surface correction and toolbar removal remain.

Dark-theme loading was also verified in native Chrome: across 109 loading-state samples,
the page, column and loading panel all computed to rgb(0, 0, 0), with readable light text.
Regression tests distinguish opaque black RGB from transparent RGBA and cover dark, light
and transparent-body/root-background combinations.
