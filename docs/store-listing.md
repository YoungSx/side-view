# Chrome Web Store submission — fill-in sheet

Everything the dashboard asks for, in the order it asks. Copy-paste from the blocks below.
Asset checklist and the upload walkthrough are at the bottom.

---

## 1. Store listing

**Name** (comes from the manifest, read-only here)
> Side View for X (Twitter)

**Summary** (132 char max — comes from the manifest `description`, editable in the dashboard)
> Read a tweet’s thread in a side column instead of losing your place in the timeline.

**Description**

> X opens a tweet by throwing away the timeline you were reading. Side View puts the thread in a
> column beside it instead.
>
> Click any tweet in your home timeline and its detail — thread, media, polls, replies — opens in a
> panel where the right sidebar was. The timeline keeps its scroll position. Click another tweet
> and the panel swaps. When you’re done, close it and you’re exactly where you left off.
>
> • Threads, media, polls and replies render natively — it’s X’s own view, not a reimplementation
> • Reply, like, repost and media clicks still work natively; ⌘/Ctrl-click still opens a new tab
> • X’s keyboard shortcuts (j / k / .) keep working
> • Adjustable column width
> • Optional: open profiles, hashtags and searches in the panel too (off by default)
>
> Built for people who read X on a wide screen and are tired of the back button.
>
> Note: this extension works on x.com / twitter.com only, and does not collect anything about you.

**Category**
> Social & Communication

**Language**
> English

---

## 2. Privacy practices

**Single purpose** (required field)

> Side View displays a tweet’s detail view in a column beside the timeline, so that opening a tweet
> does not navigate away from the timeline the user is reading.

**Justify each permission** (required, one box per permission)

`storage`

> Saves the user’s own preferences — enabled, layout mode, column width, whether profiles/hashtags
> are intercepted, and optional selector overrides — in `chrome.storage.sync`, so the settings
> follow the user across their signed-in Chrome profiles. Nothing is sent anywhere; this is the
> extension’s only stored data and the user can change all of it on the options page.

`declarativeNetRequestWithHostAccess`

> X serves the tweet-detail document with `X-Frame-Options: deny` and a restrictive
> `Content-Security-Policy`, which prevents any page — including x.com itself — from framing it.
> Side View needs to render that same document in a column beside the timeline, so it must remove
> those response headers.
>
> The ruleset is deliberately narrow: it matches only `resourceTypes: ["sub_frame"]` (framed
> documents, never top-level pages) and only when the initiator is x.com or twitter.com. It removes
> exactly three response headers — `x-frame-options`, `content-security-policy`,
> `content-security-policy-report-only` — and does nothing else. It does not block, redirect,
> rewrite, or inject anything, and it cannot affect any site other than x.com/twitter.com.

`Host permission — *://x.com/*, *://twitter.com/*`

> Two content scripts run on these origins: one watches the timeline and intercepts tweet clicks so
> the detail can open in the column instead of navigating away, and one runs inside the detail frame
> to hide X’s own navigation chrome. The extension reads nothing from these pages beyond the DOM
> structure it needs to find the timeline and the clicked tweet.

**Are you using remote code?**
> No — all logic is contained in the submitted package.

**Data usage** (checkboxes)

> Collects **nothing**. Leave every data-type checkbox unchecked, and tick all three compliance
> statements (no sale of data, no use unrelated to the single purpose, no use for creditworthiness).

Rationale to have ready if a reviewer asks: the extension contains no analytics, no telemetry, and
makes no network requests of its own. The only network traffic it causes is the browser loading
x.com’s own document into the column, using the session the user already has — from x.com, to
x.com.

**Privacy policy URL**

> Required by the dashboard. Host `docs/privacy-policy.md` at a public URL — the simplest is a
> public GitHub repo, using the rendered file URL
> (`https://github.com/<user>/<repo>/blob/main/docs/privacy-policy.md`) or GitHub Pages.

---

## 3. Graphic assets

| Asset | Size | Status |
| --- | --- | --- |
| Store icon | 128×128 | ✅ `public/icon/128.png` |
| Screenshot | 1280×800 (or 640×400) | ❌ **you must capture** — needs a logged-in x.com |
| Small promo tile | 440×280 | optional, skip for v1 |
| Marquee promo | 1400×560 | optional, only used if Google features the extension |

**Screenshot recipe** (1 is the minimum, 5 allowed — 2–3 reads best):

1. Open `https://x.com/home` at a window wide enough that the timeline has its right sidebar
   (>1280px), with the extension loaded and enabled.
2. Click a tweet with a visible thread. Wait for it to render fully (avatars, images loaded).
3. Capture the whole browser window at 1280×800 and crop to exactly those dimensions.
4. Worth having: one shot with the panel open beside the timeline, one of the options page, and one
   mid-thread with images. Caption them in the dashboard.

---

## 4. Upload walkthrough

Prerequisite: a Chrome Web Store developer account — <https://chrome.google.com/webstore/devconsole>
— one-time US$5 registration, plus identity verification if you have not published before.

1. `pnpm build && pnpm zip` → produces `.output/side-view-0.1.0-chrome.zip`.
2. Dev console → **New item** → upload that zip.
3. Fill **Store listing** from §1, upload the icon and screenshots from §3.
4. Fill **Privacy practices** from §2 — the permission justifications are the slowest part of
   review, and the `declarativeNetRequest` box is the one that gets a human. Paste the wording
   above rather than paraphrasing it.
5. Set **Distribution**: Public, all regions (or limit regions and check "no" for the paid-features
   question).
6. **Submit for review.** First review typically takes 1–3 business days; a
   `declarativeNetRequest` + header-removal extension can take longer — expect a questionnaire and
   answer it from §2.

**Bumping a version later:** bump `version` in `package.json`, re-run `pnpm build && pnpm zip`,
upload the new zip, submit. The listing text and assets carry over.
