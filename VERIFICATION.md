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
set via Options). See [docs/development.md](docs/development.md) for architecture.


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


## Threads hidden-deck click regression (2026-10-01)

Authenticated Windows Chrome, attached over CDP to the existing Threads tab. This supersedes
the home-route passthrough creation path described above. The extension's production MAIN
script was rebuilt and evaluated in that tab, replacing its previous listener via the existing
cleanup hook. These checks did not replace the installed extension on disk.

**Reproduced cause:** navigating from home to `/activity` retains two `data-deck-column` nodes
with `checkVisibility() === false` and zero-size rectangles. An activity post click updated
the hidden owned column URI while the main URL stayed `/activity`. The installed extension's
capture listener called `preventDefault` and `stopImmediatePropagation`. Merely finding a DOM
column or a working update callback therefore does not prove a visible detail can be served.
The current activity URL was observed in the actual navigation, not inferred from `/me`.

**Capability boundary:** clicks must originate in a visible native deck column; reuse also
requires the owned column to be visible. Standalone routes retain their original click and
native navigation. There is no pathname allowlist. Creation invokes the uniquely identified,
mounted `useBarcelonaCreateColumnMutation` callback from the source column, instead of sending
passthrough props through a global router. This is the callback used by native Pin to home;
Threads owns its optimistic rendering, persistence, rollback and error toast. Missing or
ambiguous callbacks leave the click native. This remains an internal site integration.

Verified with CDP mouse input and observed native state:

- Activity post and avatar clicks navigate to the requested post and profile, respectively.
- Home clicks reuse the same visible saved detail column without navigating the main page.
- With no owned column configured, creation shows a visible optimistic column, then assigns
  its numeric server ID and persists extension ownership; the main URL remains `/`.
- Scoped CDP request interception failed only `useBarcelonaCreateColumnMutation`. The temporary
  column appeared, then rolled back; Threads displayed its native failure toast and the main
  URL stayed `/`. Interception was removed, and the next click successfully created a saved
  column. No forced navigation or extension deadline was involved.
- Native Remove column removed the test column and cleared ownership without a removal timer.

The controller has no timeout, polling, or `location.assign` fallback. While creation is pending,
further clicks remain native. Mutation observations reconcile optimistic/saved ownership and
removal, rather than treating elapsed time as evidence of failure. Regression tests cover hidden
cached decks, unavailable/ambiguous actions, pending clicks, rollback, saved-ID adoption, hidden
completion, removal and DOM replacement. Test-created columns are removed after the live checks.

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

## Standalone native Threads columns and cross-platform coverage (2026-10-01)

Extends the visible-deck boundary above. Home continues to use its saved native column.
Supported standalone `/activity`, `/following`, `/saved`, `/liked`, `/for_you`, `/archive`,
`/custom_feed/:id` and `/search?q=...` routes now mount an ephemeral `BarcelonaRoutedColumn`
next to the current content. There is no navigation to home, iframe, account column creation,
manual GraphQL request, click deadline or timeout fallback.

The compatibility boundary reads the nearest provider values from the mounted page's React
ancestors and bridges them into a separate root using Threads' own React and ReactDOM. It
requires the native route store, router UI context and dispatcher before accepting a click.
The native route-code preloader loads the home column implementation without navigating.
Unavailable modules or contexts preserve the original click. Rendering failures expose an
explicit original link and Close action. This still uses internal site interfaces, not a
supported public extension API; a Threads release can require compatibility updates.

The temporary host lives inside the source page so native menu/dialog portals remain above
it. It is removed on close, disable, source removal, route change, or when it would not fit
the viewport. Native column menus and in-column navigation remain owned by Threads. No saved
home-column ownership is changed by this path.

Authenticated Windows Chrome, using a persistent CDP connection and the rebuilt production
MAIN script injected into the existing Threads tab:

- Real mouse clicks opened native post content on activity, following, liked, for-you,
  custom-feed and tag-search pages while retaining the source URL and query parameters.
- Repeated activity clicks reused one temporary host with different post content.
- The native Remove column menu closed the temporary host and removed the source layout marker.
- SPA navigation removed the temporary host and restored the previous page layout.
- A fresh direct activity document initially had no native routed-column module. Injecting
  the new production script preloaded it, and a real click rendered the thread without
  first visiting home. DOM inspection found no iframe and no saved deck column.
- Resizing to 1200 CSS pixels removed the panel and layout marker without navigating;
  the original device metrics were then restored.
- At 1600 CSS pixels the source occupied x=260..900 and the panel x=916..1556, clear of
  the navigation ending at x=215. Disabling the controller immediately removed the panel
  and layout marker; the original configuration and device metrics were restored.
- A screenshot of the following page confirmed separate source and native detail columns.
- Saved and archive were empty in this account. Their visible scroll-container structure
  and empty states were inspected; actual post-click E2E on those two routes remains unverified.

X and Bluesky checks used the newly bundled adapters against the authenticated live DOM,
plus unit and layout regression tests; they did not replace the installed isolated-world
extension engine. X home still resolves canonical statuses while `/photo/1` and `/analytics`
links remain native; notification settings and tabs also remain native. Bluesky notification
and search pages now resolve their visible 600px content column instead of a hidden cached
home feed. Search result bodies without home-feed test IDs resolve the same canonical post
as their timestamps. New-tab/download destinations, dialogs, tabs and interactive controls
are excluded. The installed extension on disk has not been replaced by these injected checks.

Final checks: 134 tests passed; TypeScript, Biome, production build and `git diff --check` passed.

## Reading-session and document-navigation boundaries (2026-10-01)

Each main-page X/Bluesky selection now mounts a fresh iframe reading context, including
reselecting the same original URL after navigating within the pane. Ordinary label refreshes
retain the current frame. Closing still discards the reading context. Internal platform
navigation is not replaced by an extension router.

The iframe load handler tracks Document identity rather than a single lifetime `settled` bit.
A new same-origin Document gets its own native-header controls, and the previous Document's
observer/actions are disposed. Repeated load events for the same Document do not duplicate
controls. Cross-origin/blocked loads enter recovery; returning to a readable Document restores
controls. Initial-document stale-load and initial readiness checks remain intact.

X root-level native Back closes the pane when both the canonical root URL and the original
native history entry key match. A deeper visit to the same URL does not count as root. Missing
native history identity leaves the control native. Other platforms' Back controls are unchanged.

Threads saved-column retargeting now invokes the mounted native
`useBarcelonaColumnRouterReset` callback instead of replacing only the current history entry.
The reset capability is checked before any saved-column update; if it is missing, the original
click remains native. Temporary standalone columns already start a new native reading tree.

Live checks use a temporary harness bundling the actual new iframe provider/components and X
adapter, with only translation strings substituted, in the authenticated X page. This exercises
the changed renderer and the installed frame CSS/DNR without replacing the installed engine.
An internal profile navigation stayed in the frame; a forced full-document same-origin
navigation produced one action group in the new Document and zero in the old Document, with
the main URL remaining `/home`. Threads native state inspection confirmed a two-entry history
stack reset to one entry, retaining the saved column ID and top-level `/`; the original saved
column URL was restored.

Validation correction: the first renderer harness was mounted in the user's existing X tab
alongside the installed extension's open panel. That produced two visible detail hosts and
was not a valid whole-page visual acceptance test. The temporary harness was removed and
the original tab was checked to contain one extension host and one iframe. Follow-up checks
use a separate disposable tab with a guard refusing to mount if any detail host already exists.
In that tab, A -> profile -> selecting A again replaced the iframe, disconnected the old
instance, and retained exactly one detail host. This is renderer-level verification, not a
claim that the installed extension was updated.

In the disposable tab, X root-level native Back removed the sole test detail host while the
main URL remained `/home`. The disposable tab was closed; the original user tab retained
one installed-extension host and no test host. Final reading-boundary checks: 138 tests,
TypeScript, Biome, production build and `git diff --check` passed. Installed-extension E2E
acceptance remains outstanding; renderer/adapter checks above are explicitly narrower.

## Installed-extension native Back regression (2026-10-01)

Supersedes the native-history-key implementation and the installed-extension acceptance gap
above. The existing X tab and a newly opened tab initially ran an older cached extension
script despite the newer file on disk. After reloading the extension and the test page,
CDP `Debugger.getScriptSource` was compared byte-for-byte with the production `timeline.js`.
The fixed build was installed into the existing unpacked-extension directory and reloaded
the same way; no second renderer or temporary sidebar was injected.

The reading root now uses the browser's Navigation API entry key, held for the lifetime of
the reading across Document changes. X's private history state is not used. Root Back is
independent of native-header layout readiness; a deeper visit to the same URL remains native.
Main-page X Back with an open reading closes the iframe before traversing to the main frame's
own predecessor, so child history cannot consume that action. With no same-origin predecessor
or no Navigation API, the iframe closes and X retains its native fallback. Main-route changes
dispose the reading instead of reattaching a potentially reloaded iframe.

Authenticated Chrome CDP smoke used one persistent connection and the installed extension.
Post selections used DOM clicks through the real content-script router; native Back and
profile controls used CDP mouse input. Focus emulation on the disposable test tab prevented
Chrome's background-page animation-frame suspension from stalling header reconciliation.

- Home and Search: opening a post and native root Back removes the sole side column without
  changing the source URL. Closing and reopening works.
- Post -> author profile -> native Back -> original post -> native Back closes the column.
- Search -> open post -> author profile -> click the **main Search** Back returns to Home
  and removes the column, rather than leaving Search in place and navigating the iframe.
- Search main Back while the iframe is at its root also removes the column and returns Home.
- Main-list A -> B and profile -> reselect A replace the old iframe; root Back then closes.

Unit regressions cover mutable platform history state, repeated URLs with distinct navigation
keys, reading identity across action reinstallation, Back before header-layout readiness,
main-route cleanup, modified/unrelated clicks, missing Navigation API, fallback and teardown.
146 tests, TypeScript, Biome and the production build passed. Browser-toolbar history remains
browser-owned; this change targets X's page-native Back controls. Firefox and live Bluesky
navigation were not part of this CDP acceptance run.

## Compact navigation left gutter (2026-10-01)

Compact navigation is extension CSS, not a native X mode toggle. X's outer banner uses
`flex: 1 0 auto` and aligns the inner navigation to its right edge, providing the page's
left gutter. Forcing that banner to `flex: 0 0 88px; width: 88px` removed the gutter.
The fix only narrows the inner navigation wrappers and preserves the native banner flex.

Authenticated Chrome checks reused one persistent CDP WebSocket and target sessions.
At a 1994 CSS-pixel viewport, the old compact CSS placed the rail at x=0 and the timeline
at x=88. Removing the outer-banner override restored the rail to approximately x=450
and the timeline to x=538, with an 88px rail and 600px timeline.

The rebuilt `timeline.js` was copied into the existing unpacked extension directory
(matching SHA-256), and the extension and disposable X test tab were reloaded. Toggling
the actual options-page switch injected the corrected CSS without a temporary override.
Viewport probes covered 699, 1000, 1280, 1440, 1994 and 2560 CSS pixels; screenshots were
visually checked at the desktop size. Opening a real post produced one detail host with
a 600px iframe and retained the gutter. Closing detail removed the host while retaining
compact navigation. Disabling compact navigation removed its stylesheet and restored the
original 275px navigation and timeline x=632. Test settings were restored afterward.

146 tests, TypeScript, Biome, production build and `git diff --check` passed. This change
and live acceptance cover X; Bluesky and Threads implementations were unchanged.

## Native compact-navigation exploration (2026-10-01)

The CSS-only implementation above is not the final navigation design. Subsequent reports
identified malformed compose buttons and Bluesky horizontal overflow. Temporary CDP probes
in disposable authenticated tabs disabled `sv-compact-nav` before testing native mechanisms.
These probes are feasibility evidence, not installed-extension acceptance of a native bridge.

- X's mounted layout exposes `setSideNavForceCollapased(boolean)` through its layout context
  (spelling as shipped). It updates a reference count and passes `forceCollapsed` to the native
  header. A balanced true/false call at viewport width 1994 folded the rail from 275px to 68px
  and rendered X's own 52x52 compose button. The left gutter and right sidebar x-coordinate
  were preserved; the 600px timeline moved left. This is a private runtime capability, not
  a public extension API. Integration must validate it and release only its own count.
- Bluesky's official `src/alf/breakpoints.ts` derives `leftNavMinimal` from
  `(max-width: 1300px)`, separately from `rightNavVisible` and `centerColumnOffset`.
  `src/view/shell/desktop/LeftNav.tsx` uses that state for the whole native navigation tree:
  an 80px rail, 48x48 compose control with a 24px native icon, account control and horizontal
  overflow handling. A probe dispatched only that navigation component's matching boolean
  hook state. At width 1994 the native rail rendered correctly, with main/right geometry
  unchanged and no horizontal scrollbar. Screenshot inspection confirmed the result.
  A narrow-then-wide resize restored the 240px rail, demonstrating that a one-shot hook
  dispatch is not a persistent setting. No dedicated navigation toggle callback was found.

Do not ship fixed hook indices, fake a Messages route, or globally override viewport/media
queries to enable this feature. A Bluesky integration still needs a validated, scoped lifecycle
boundary; availability should fail closed if that boundary cannot be established. Native
probes were released and test tabs closed. Threads should hide the unsupported popup switch.

## Installed native compact-navigation bridge (2026-10-01)

Supersedes the CSS implementation and the one-shot exploration above. The extension now ships
a MAIN-world bridge with a boolean DOM request and capability status. X collapse ownership is
balanced across updates/replacements and teardown. Bluesky's state is located by the exact
native media-query/effect relationship in the mounted LeftNav component, never a fixed hook
index. Only that component is updated; native media queries remain untouched. Navigation-tree
mutations and resize/route events reconcile the request; ordinary timeline mutations do not.
Disabling restores the current breakpoint. Missing/ambiguous capabilities do not trigger CSS.

Authenticated installed-extension CDP acceptance (one persistent WebSocket):

- Options-page switch activated native navigation on both sites, with no compact stylesheet.
  X rendered its native SVG and 52x52 compose button; Bluesky rendered its native SVG and
  48x48 compose button, 80px rail and native horizontal-overflow handling.
- 1100, 1500 and 1994px viewport probes retained compact controls; narrow-to-wide resizing
  no longer reverted Bluesky. X Home/Explore and Bluesky Home/Search navigation, plus full
  page reloads, retained the preference.
- Both compose controls opened native editors; Escape dismissed them without entering text.
- Both sites opened one 600px detail iframe from a real feed item while compact stayed active.
- Disabling the master switch restored 275px X and 240px Bluesky navigation at desktop width.
- The real toolbar popup over Threads omitted compact navigation, including its needs-reload
  state. Unit coverage also checks unavailable native capabilities and supported X controls.

156 tests, TypeScript, Biome, production build and diff whitespace checks passed. Tests include
balanced ownership with another native X consumer, remounts, missing/ambiguous capability,
current-breakpoint restoration, scoped reconciliation, invalidation and master-switch release.
Final artifacts were installed in the existing unpacked-extension directory and reloaded.
These are validated private compatibility boundaries, not stable public site APIs; Firefox
was not part of this live acceptance run.

## Replica column box and profile/search coverage (2026-10-02)

Supersedes the host description in the section above. The replica no longer owns its layout:
it no longer writes a stylesheet, no longer sets `position:fixed` + `height:100dvh` +
`overflow:auto`, and no longer pads `#barcelona-page-layout`. That padding inflated the page
row past the viewport and produced a second scrollbar outside the column.

The host is now a plain `div[data-sideview-threads-panel]` inserted as the last child of
Threads' own flex row, carrying only a measured box:

- Width and height come from a live `[data-deck-column]` when the page has one, which makes
  Threads' responsive shrinking (640px with two columns down to 420px with four) automatic.
  A native column is viewport-tall and scrolls inside itself, so where there is no native
  column the replica takes its width from the timeline beside it and its height from the
  viewport. Growing with content instead would leave the two columns on different scroll
  models. Measured replica: 1022px tall, inner column 962px with `scrollHeight` 1179.
- The inter-column gap is Threads' own, read from a native column's margin when one exists
  and otherwise the 12px observed on a two-column home timeline. It is carried on the
  replica's leading edge, so no margin is written onto the site's column. Measured box to
  box: 983 → 995 = 12px, matching the native pair exactly.
- The host is a **grid** container with `grid-template-rows: minmax(0, 1fr)`, not a flex
  column. As a flex container the site-rendered child keeps its `min-height: auto` floor,
  grows past the box and is clipped; the grid track lets it shrink, so the inner
  `[data-column-scrollable]` becomes the only scroller, exactly as in a native column. This
  constrains it without writing any style onto Threads' own element.
- Nothing is measured that cannot be measured: an unmeasurable page leaves the click native
  rather than falling back to hardcoded widths. Over-width is detected after mounting,
  because Threads clips its page row rather than scrolling it.
- `resize` re-measures instead of re-applying a stale width.

`nativeColumns()`, `createNativeColumn()` and `updateNativeColumn()` ignore anything inside the
replica, so it can never be adopted, retargeted or reported as an owned column.

Route coverage now includes profiles (`/@handle`) and both `/search?q=` results and the empty
`/search` page's recommended-user list. `/messages`, `/settings`, `/@handle/followers` and
`/custom_feed/:id/edit` remain excluded.

Measured on authenticated threads.com, viewport 1994x1022, via the persistent CDP bridge:

| Route | Native columns | Replica | Replica box | Inline style on page row |
|---|---|---|---|---|
| `/` | 2 | 0 (native path) | — | none |
| `/@bushejiao` | 0 | 1 | x=989, w=640 | none |
| `/search?q=ai` | 0 | 1 | x=989, w=640 | none |
| `/search` | 0 | 1 | x=989, w=640 | none |

`documentElement.scrollHeight === clientHeight` on the home route, so no window-level scrollbar
appears. Profile and search scrolled as documents before this change too; on those routes the
replica grows with its content, matching the route's own scroll model.

Still internal site interfaces rather than a supported public extension API: the column module
name, the three router contexts, the preloader and the measured column geometry. A Threads
redesign can require compatibility updates.

### Native pair, measured for reference (2026-10-02)

Two native columns on the home timeline, viewport 1994x1022: 12px apart, each 640x1022
with `margin: 0 12px 0 0`, each inner `[data-column-scrollable]` 640x950 with
`padding: 20px 0 0`, `border-radius: 24px`, `overflow-y: auto` and scrolling internally.
This is the shape the replica is measured against; the home route itself needs no replica
and continues to use Threads' own columns.

## Xiaohongshu split feed and profile reading (2026-10-04)

Verified in the running, authenticated Windows Chrome with the unpacked production extension.
CDP commands used one persistent browser WebSocket, request IDs and flattened target sessions.
The current WebSocket endpoint came from Chrome's `DevToolsActivePort`; HTTP
`/json/version` returned 404. CDP scripts and screenshots stay in ignored `output/`
and are not included in the extension. The extension requests no debugger permission.

### Layout correction

A CSS-only reservation did conceal the fifth column: its cards still started at x=1422
while the pane started at x=1394. The native layout store computed positions from the full
window width, so narrowing the app and firing resize was insufficient.

The MAIN-world bridge now validates the mounted Pinia layout store and patches only its
column count and width. The site's own feed relayout controller handles positions,
virtualization and scroll anchors. Closing restores the current native layout via its resize
action. Missing capability leaves clicks native.

Live geometry in a 1994px viewport, after allowing the native relayout to settle:

| Configured pane width | Actual pane width | Feed columns | Card width | Cards beyond pane boundary |
| --- | --- | --- | --- | --- |
| 320px | 320px | 5 | 263.5px | 0 |
| 600px | 600px | 5 | 207.5px | 0 |
| 1200px | 997px (half viewport) | 4 | 168.2px | 0 |

At 600px, the furthest card edge was x=1361.6 and the pane began at x=1394.
Three additional scroll/virtualization checks also found zero cards past that boundary.
Closing restored five 274.4px native columns; reopening reflowed the complete feed again.
At a 1300px viewport the 600px pane left three 146.7px columns, with zero concealed cards.
At 1000px, a real cover click opened the site's own note modal with no extension host.
Closing that modal and restoring the viewport returned the native layout.

### Real navigation clicks

- Home note covers open, switch and close in the side column without changing the main route.
- Search note links retain `/search_result/:note` and `pc_search`.
- A real left-feed author click opened a responsive 600px profile in the right column.
  The main route stayed `/explore`, scroll stayed at 0 and the 30 mounted cards had no overlap.
- Clicking a note within that profile opened the site's native note modal in the frame.
  Shared detail actions moved to the note's author header. The native close returned to
  the profile and the actions returned to its nickname header.
- Clicking a note's author within the frame navigated to its profile in that same frame;
  the browser page-target count did not increase. Clicking another left author replaced
  the profile; a subsequent left-note click replaced it with the selected note.
- On a main user-profile page, clicking a signed `/user/profile/:user/:note` cover
  opened `/explore/:note` in the pane. The main profile route and all 32 mounted
  cover paths stayed unchanged, with zero cards beyond the pane boundary.

Default author `target="_blank"` is intentionally intercepted for ordinary clicks.
The shared profile setting controls left-feed author interception. Unit tests cover retained
access parameters, missing source defaults, unsigned SEO-link rejection, profile-note
normalization, modifiers/middle-click, likes, explicit targets and action-link exclusions.
Topics and search links remain native. No Xiaohongshu frame-header relaxation is needed.

Quality checks: TypeScript, Biome, production Chrome build and 186 tests in 23 files passed.
Live acceptance is Chrome desktop; Firefox and private-layout-interface drift remain outside
this smoke. Foreground/focus emulation was used for reliable native animation-frame relayout
and header reconciliation in disposable test tabs.
