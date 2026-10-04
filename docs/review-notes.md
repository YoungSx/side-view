# Chrome Web Store review notes

Drafted for the reviewer's "Notes / justification" fields. Every claim below was
checked against the source at the time of writing; the file and line references
let a reviewer verify them independently.

## What the extension does

Side View opens a social post in a column beside the feed instead of navigating
away from it. It supports X, Bluesky, Threads and Xiaohongshu, and it is not affiliated with
any of them.

## Data flow

There is no server operated by the developer. The packaged code contains no
`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `eval` or `new Function`
call, and the only external hosts it references are the four platforms
themselves. Every read happens in a content script on the page the user is
already viewing, and is discarded when the view closes.

Full detail: [privacy-policy.md](../docs/privacy-policy.md).

## Permission justifications

| Permission | Justification |
| --- | --- |
| `storage` | Stores user preferences in `chrome.storage.sync` (on/off, layout, width, compact navigation, link-interception preference, selector overrides, UI language) and the reused Threads native column ID in `chrome.storage.local`. No data is transmitted. |
| Host access — `*://x.com/*`, `*://twitter.com/*` | Identify a post from the DOM the user is already viewing, open its detail in the side column, integrate with the native top bar, and restore the original layout on close. Read-only against the page. |
| Host access — `https://bsky.app/*` | Same, for Bluesky. |
| Host access — `https://www.xiaohongshu.com/*` | Open the clicked note or author profile in a same-origin frame beside the feed, preserving its access parameters. A MAIN-world script updates the native layout dimensions so every feed column remains visible. No frame-header relaxation or debugger permission is used. |
| Host access — `https://*.threads.com/*`, `https://*.threads.net/*` | Respond to a real user click and use Threads' own column feature to create or update one native detail column. See "Threads native column" below. |
| `declarativeNetRequestWithHostAccess` | One rule each for `x.com` and `twitter.com`, scoped to `sub_frame` requests initiated by the same origin. See "Frame headers on X" below. |

No `all_urls`, `cookies`, `history`, `tabs`, `debugger` or `<all_urls>`-style
broad host access is requested.

## Threads native column — the main review question

This is the part most worth explaining up front, so here is the full picture.

**What happens.** When the user clicks a post on Threads, the extension asks
Threads to create or update **one native Threads column** and loads that post
into it. The column is created and managed by Threads itself, using Threads'
own in-page API. The extension never renders or styles that column; it only
asks Threads to create it.

**Where the code runs.** `src/entrypoints/threads-native.content.ts` is declared
in the `MAIN` world so it can reach Threads' own in-page functions. It does not
create or modify any column on its own. It acts only when it receives a
`config` message from the extension's own content script, and creates or
updates a column only after a genuine user click.

**The click handler is guarded.** `native-controller.ts` requires
`event.isTrusted` (so synthetic clicks cannot drive it), ignores modified
clicks (ctrl / meta / shift / alt), ignores clicks on interactive elements or
inside the extension's own column, and ignores clicks inside a text selection.
A column is never created without a real user action on a post.

**The message channel is validated.** The `message` listener requires
`event.source === window`, `event.origin === location.origin`, a specific
channel name, and `type === 'config'`, then type-checks every field before
using it. It ignores anything else on the page.

**No remote code.** Nothing is downloaded and executed. `native-runtime.ts`
contains no `eval`, no `new Function`, no dynamic `import()` and no `fetch`. It
calls functions that already exist in the loaded Threads page. The extension's
own code is fully contained in the submitted package and is inspectable there.

**This is not hidden styling.** The distinction matters: the extension is not
merely restyling a page to look like it added a column. Threads genuinely
creates and persists the column, which is why it survives a reload and appears
on the user's other devices. That persistence is Threads' behaviour, and the
extension discloses it rather than concealing it.

**The column persists.** Because the column belongs to Threads, it is saved to
**the user's own Threads account by Threads**, not by this extension. Turning
the extension off does not remove it, and neither does uninstalling it. To
remove it, the user must use Threads' own "remove column" affordance. This is
stated in the privacy policy, in the store description and in the extension's
own settings page.

**Why a native column at all.** An isolated `iframe` column would be simpler,
but Threads' own layout engine does not reflow around one, so the result would
not look or behave like part of Threads. Using Threads' own column feature is
what makes the feature feel native, and it is why the extension accepts the
disclosure burden above.

**Maintenance.** Threads' internal module names and function shapes can change.
The extension degrades gracefully: if the expected column API is unavailable,
the feature turns off and the rest of the extension continues to work. Selector
overrides are exposed in the Advanced settings section for the X DOM.

## Frame headers on X — the second question

**What the rule does.** One `declarativeNetRequest` rule per X origin
(`x.com`, `twitter.com`). Each is scoped to:

- `resourceTypes: ["sub_frame"]` — documents loaded in a frame, not the top page
- `initiatorDomains: ["x.com"]` — only requests made by X itself
- `urlFilter: "||x.com/"` — only X URLs

**Why.** The detail column loads an X post in a same-origin sub-frame. X sends
`X-Frame-Options` and a `Content-Security-Policy` that prevent this. Without
removing them the column cannot render. The headers are removed **only for that
specific same-origin sub-frame request**.

**Scope is deliberately narrow.** The rules do not apply to top-level
navigation, to any other resource type, to any other initiator, or to any other
domain. There is no Threads or Bluesky network modification of any kind. The
main page's own security headers are untouched, and no request is redirected,
blocked or observed.

**Note for the reviewer.** The rule removes the full CSP header, not only
`X-Frame-Options`, because the CSP that X sends on the detail route also blocks
framing. The rule is scoped as described above, and the extension makes no
network request of its own on any origin. The exact rules are in
`public/rules/frame-headers.json` and are shipped in the package as
`rules/frame-headers.json` — two rules, one per X origin, with no other
`modifyHeaders` rule anywhere in the extension.

## Not affiliated

Side View is an independent extension. It is not affiliated with, endorsed by,
or sponsored by X Corp, Bluesky Social, or Meta Platforms. Platform names are
used only to describe which sites the extension works on.

## Accessibility of source

Full source is public at <https://github.com/YoungSx/side-view>. The submitted
package is the build output of that repository at the stated commit, containing
only the compiled extension: no source maps, no test files, no logs, and no
credentials.

## If a test account is required

The extension needs a logged-in session on each platform to demonstrate the
detail column, exactly as it would in normal use. Provide a dedicated test
account rather than a personal one, with these steps per platform:

1. Log in on the platform and open the home timeline.
2. Click any post. The detail opens beside the feed; the timeline keeps its
   place.
3. Switch to another post in the column. The timeline does not move.
4. Close the column. The original layout is restored.
5. Reload the page and confirm the preference persisted.

For Threads, additionally: confirm the native column appears in Threads' own
column UI, and that removing it there makes it disappear for the extension too.
