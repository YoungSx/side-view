# Privacy Policy — Side View for X (Twitter)

**Last updated:** 30 September 2026

> Before publishing: replace `[contact email]` below with a reachable address, and host this file at
> a public URL (see the note at the bottom of `store-listing.md`).

Side View is a browser extension that shows a tweet’s detail view in a column beside the timeline.

## What it collects

**Nothing.** The extension has no analytics, no telemetry, no crash reporting, and no server of its
own. It does not transmit any information about you, your browsing, or your usage to the developer
or to any third party. There is no data to sell or share, and none is sold or shared.

## What it stores, and where

The only thing Side View saves is **your own settings** — whether the feature is enabled, the
layout mode, the column width, whether profiles and hashtags open in the column, and any optional
CSS-selector overrides you enter. These are written to `chrome.storage.sync`, Chrome’s built-in
settings store, which Google may sync across your signed-in Chrome profiles under
[Google’s privacy policy](https://policies.google.com/privacy). The developer cannot read them, and
they never leave your Google account.

You can change every one of these on the extension’s options page, and uninstalling the extension
removes them.

## What it accesses on the page

On x.com and twitter.com, the extension reads the page’s DOM to find the timeline and the tweet you
clicked. This happens entirely inside your browser; nothing about it is recorded or transmitted.
The tweet detail is displayed in a frame that loads x.com’s own page, from x.com, using the session
you are already signed in to — the same content you would see by clicking the tweet normally.

The extension removes three HTTP response headers (`x-frame-options`,
`content-security-policy`, `content-security-policy-report-only`) from x.com’s own framed
documents, so that x.com’s detail page is allowed to render inside the column. This modification
applies only to x.com / twitter.com frames and only when x.com itself is the initiating page. It
does not block, redirect, or alter requests to any other site, and it does not affect x.com pages
that are not framed by the extension.

## Permissions

- **`storage`** — to save your settings, as described above.
- **`declarativeNetRequestWithHostAccess`** — to remove the framing-related response headers from
  x.com’s own framed documents, as described above.
- **`*://x.com/*`, `*://twitter.com/*`** — to run the content scripts that intercept tweet clicks
  and render the column on those sites. The extension is inactive everywhere else.

## Children

The extension is not directed at children and collects no data from anyone, including children.

## Changes

If this policy changes, the updated version will be posted at this URL with a new “last updated”
date. Material changes will also be noted in the extension’s Chrome Web Store listing.

## Contact

Questions about this policy: `[contact email]`.
