# Store promotional image

`small-promo-440x280.png` is the Chrome Web Store small promo tile. It is a
designed graphic, not a screenshot: a browser window with a highlighted post on
the left, an arrow, and the sidebar column on the right, so the idea still reads
when the tile is rendered small next to the listing title.

## Export

- 440x280 px, PNG, 24-bit RGB with no alpha channel.
- 136 KB. Flattened against its own background; do not re-export with
  transparency, which the dashboard rejects.
- The file is the source of truth. There is no generator script, unlike
  `assets/icon/`: this artwork was drawn once and is re-exported by hand from
  the design tool, not derived from another checked-in file.

Verified locally on 2026-09-30 with .NET `System.Drawing`
(`Width`/`Height`/`PixelFormat`) — the numbers above are measured, not assumed.

## Chrome Web Store use

- Upload this file as the small promo tile in the Store listing. It is a
  required field; the 1400x560 large promo tile is optional and still missing.
- Do not use this file as the extension icon. The packaged icon is
  `public/icons/128.png`; see [icons](../icon/README.md).
- The wordmark reads "Side View" only. The listing title is localized per
  language as `Side View — Social Post Sidebar` / `Side View — 社交动态侧栏` /
  `Side View — 社群動態側欄` / `Side View — ソーシャル投稿サイドバー`, and the
  store listing takes its title from `manifest.name` via `__MSG_extName__`. A
  static tile cannot localize, so it deliberately carries no suffix; the
  platform names live in the description instead.
- The artwork is abstract and shows no platform logos or trademarks. That is
  intentional: the extension icon still references the old Twitter bird and its
  licensing is unresolved (see [icons](../icon/README.md)). The promo tile
  should not reintroduce that risk.
- This completes the promo tile only. At least one 1280x800 or 640x400
  screenshot is still required, and neither asset addresses the icon
  trademark question.

Official reference: [Store image requirements](https://developer.chrome.com/docs/webstore/images)
