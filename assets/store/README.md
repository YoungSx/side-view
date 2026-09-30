# Store listing assets

Two kinds of image go in the Chrome Web Store listing: one small promo tile and
the screenshots. They are kept together here because they are uploaded in the
same pass and share the same privacy constraints.

## Small promo tile

`small-promo-440x280.png` is the Chrome Web Store small promo tile. It is a
designed graphic, not a screenshot: a browser window with a highlighted post on
the left, an arrow, and the sidebar column on the right, so the idea still reads
when the tile is rendered small next to the listing title.

### Export

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

## Screenshots

`screenshots/` holds the four store screenshots, all 1280x800. They were
produced by `scripts/prepare-store-screenshots.py` from captures kept outside
the repository; the script re-derives them and is the place to change anything
about how they are prepared. It never modifies the source captures.

| File | Platform | Note |
| --- | --- | --- |
| `01-x-sidebar.jpg` | X | account row masked, see below |
| `02-bluesky-sidebar.jpg` | Bluesky | no identity visible |
| `03-threads-native-column.jpg` | Threads | no identity visible |
| `04-settings.png` | Settings | settings page, shows the wordmark |

- `01`: the logged-in account row in the left nav is filled with the nav's own
  flat `(1, 1, 1)` background, so there is no mosaic edge to give the edit away
  and the sidebar simply reads as empty. Verified by pixel count rather than by
  eye: 2137 non-background pixels in that strip before, 0 after, with the rest
  of the nav unchanged. **Never commit the unmasked capture.** The screenshots
  are permanently public on the store page, so a personal handle there would be
  indexed by search engines.
- `04`: the source capture was 2490x1275 and is not a store-legal size. It is
  scaled to 800px tall and cropped on the right; the crop lands entirely in the
  measured dead space to the right of the content and takes the scrollbar with
  it, so nothing is cut from the page itself and no padding is introduced. PNG
  rather than JPEG because the page is flat near-black, exactly where JPEG
  banding shows up. The other three are photographic and stay JPEG.
- `04` is the reason the wordmark was unified in the same change: at store size
  the settings screenshot puts "side-view" next to a listing titled
  "Side View", which reads as a contradiction on the store page itself.
- `03` is the strongest single image — the timeline and the reused native
  column side by side show the Threads behaviour that a screenshot alone has to
  communicate.

Official reference: [Store image requirements](https://developer.chrome.com/docs/webstore/images)
