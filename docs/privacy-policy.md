# Privacy Policy

**Last updated: 2026-09-30**

Side View is a browser extension that shows a social media post in a side column beside your
feed, so you can read it without losing your place. This policy explains what the extension
reads, what it stores, and what it sends.

## Short version

- The extension **does not collect, transmit, sell, or share your personal information.**
- It reads the post you are viewing **in your browser, on your device**, only to render that post
  in the side column.
- It stores your settings locally. Nothing is sent to a server operated by the developer.
- One feature — the Threads native column — is saved to **your Threads account** by Threads
  itself, not by us. See below; this one needs your attention.

## What the extension reads

To render the side column, the extension reads content from the page you are already viewing on:

- `x.com` and `twitter.com`
- `bsky.app`
- `threads.com` and `threads.net`

Specifically, it reads the text and links of the post you clicked, plus structural information
about the page (element positions) needed to place the column.

This reading happens **in your browser, on your device**. The content is used for one purpose:
displaying the post you selected in the side column. It is not stored, not logged, and not sent
anywhere.

## What the extension stores

Your settings are stored by your browser, not by us:

| Storage | Contents | Purpose |
| --- | --- | --- |
| `chrome.storage.sync` | On/off, column layout, column width, compact navigation, link-interception preference, selector overrides | Preferences. Sync storage means your browser may carry these across devices signed into the same profile. |
| `chrome.storage.local` | The ID of the Threads native column | So the extension can find the column it created again. Stays on this device. |

We cannot read this storage, and neither can anyone else.

## Important: the Threads native column

Threads does not offer a way to open a post in a side panel. To provide the same feature on
Threads, the extension creates and reuses **one native Threads column**, using Threads' own
built-in functionality.

Because that column belongs to Threads, its configuration is **saved to your Threads account by
Threads itself**, not by this extension.

This means:

- The column persists on Threads' servers as part of your account.
- **Turning the extension off does not remove it.**
- **Uninstalling the extension does not remove it.**

If you want it gone, open Threads and remove the column using Threads' own "remove column"
control.

This is the one place where activity related to your use of the extension is stored by a third
party. We have no access to it.

## Network activity

The extension contains **no analytics, no telemetry, no tracking, and no advertising code**. It
does not phone home. The only network requests it makes are the ordinary page loads that you and
the sites you visit already make — the extension adds no server of its own.

However, being precise about two things:

**Response headers on X and Twitter.** So that a post can be displayed in an embedded frame, the
extension removes the `X-Frame-Options` and `Content-Security-Policy` headers from responses
served by `x.com` and `twitter.com` to frames those sites create themselves. This affects
framing behaviour only. It does not alter content and does not change what is sent to those
servers.

**Threads.** As described above, the native column configuration is stored by Threads on your
account.

Neither of these sends your data to us.

## Permissions, and why they are needed

| Permission | Why |
| --- | --- |
| `storage` | Save your settings and the Threads column ID. |
| `declarativeNetRequestWithHostAccess` | Remove the framing headers described above, for X and Twitter only. |
| Access to `x.com`, `twitter.com`, `bsky.app`, `threads.com`, `threads.net` | Read the post you clicked. No other site is touched. |

The extension requests access to **no other site**.

## Children

The extension is a utility for reading social media posts. It is not directed at children and
collects no information from anyone.

## Third-party platforms

Side View is an independent project. It is **not affiliated with, endorsed by, or sponsored by**
X Corp., Bluesky Social PBC, Meta Platforms, Inc., Threads, or Google. Any trademarks belong to
their respective owners. Post content remains the property of its authors and the platforms that
host it.

## Changes to this policy

If this policy changes, the "Last updated" date above will change and the updated policy will be
published at this same URL.

## Contact

Questions or concerns: please open an issue at
<https://github.com/YoungSx/side-view/issues>.

---

*This policy describes the behaviour of Side View version 0.1.0. It was written to match the
source code in the repository it links to. If you find a discrepancy between this policy and what
the extension actually does, that is a bug — please report it.*