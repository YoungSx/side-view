# Support

Side View is an independent extension. It is not affiliated with, endorsed by,
or sponsored by X Corp, Bluesky Social, or Meta Platforms.

## Where to get help

**Report a bug or request a feature:**

<https://github.com/YoungSx/side-view/issues>

Please include:

- What you did, what you expected, and what happened instead
- Which platform (X, Bluesky or Threads) and whether the side column opened
- Your Chrome version, and the extension version from `chrome://extensions`
- Whether the problem is reproducible every time or intermittent

**Security or privacy concern:** open an issue, or email
`shangxin@outlook.com`. Please do not post credentials, tokens or personal
data in a public issue.

## Before reporting a platform-specific problem

The extension attaches to each site's own DOM. When a site changes its markup,
a feature can stop working until the extension is updated.

Quick checks that often resolve it:

1. Reload the tab. The extension attaches on load.
2. Confirm the extension is enabled on `chrome://extensions`.
3. Check whether the platform's own layout changed — a feature that depends on
   the site's column layout (the Threads native column, for example) is managed
   by the site, not the extension.
4. Update the extension to the latest version.

## Removing the Threads native column

Threads creates and stores one native column in **your Threads account**, so the
extension does not own it. Turning the extension off does not remove it, and
neither does uninstalling the extension.

To remove it, use Threads' own column menu and remove the column there. The
extension stops using it immediately after that.

## Privacy

What the extension reads, stores and does not collect is documented in
[privacy-policy.md](privacy-policy.md). In short: post content is read from the
page you are already viewing to render the side column and is not stored or
sent anywhere, preferences stay in your browser, and there is no server operated
by the developer.
