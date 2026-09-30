# Extension icon

`source.png` is the approved artwork: a taller blue rear page behind a front-facing
pale panel containing the cropped, left-facing bird. Keep this source unchanged;
earlier design explorations remain local under the ignored `output/` directory.

## Export

The extension uses the checked-in `public/icons/{16,32,48,128}.png` files. Python
is not needed for installation, development or the extension build. To regenerate:

```sh
uv run scripts/generate-icons.py
```

Alternatively, with Python 3.10+ and Pillow 12.2.0 installed:

```sh
python scripts/generate-icons.py
```

The exporter trims the source's excess transparent margin using an alpha >16
bounding box, preserves the artwork's aspect ratio and colors, and centers it on
transparent RGBA canvases. The 128px export fits the artwork into a 96px box
(at least 16px padding per side). The 16/32/48px versions use 14/28/42px artwork
boxes for legibility in browser UI. No gradients or new artwork are added.

## Chrome Web Store use

- `wxt.config.ts` declares the four PNGs in `manifest.icons`. WXT copies them into
  the extension ZIP under `icons/`; use the packaged `icons/128.png` for the store
  icon. The settings page also uses the same artwork and 16/32px favicons.
- Chrome requires a 128x128 PNG in the extension package. Its guidance for a
  near-square icon is approximately 96x96 artwork with transparent padding;
  the icon should read on both light and dark backgrounds. Our exports retain
  alpha and do not add an enclosing tile, outline or shadow.
- This completes the icon asset, not the entire listing. A separate 440x280 small
  promotional image and at least one 1280x800 or 640x400 screenshot are also
  required. The extension icon is not a substitute for those assets.
- The approved design intentionally references the old Twitter bird. Image-size
  compliance does not establish permission to use that mark or guarantee store
  approval. Before publishing, resolve the right to use the mark and ensure the
  listing does not imply official affiliation or endorsement.

Official references (checked 2026-09-30):

- [Configure extension icons](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons)
- [Store image requirements](https://developer.chrome.com/docs/webstore/images)
- [Impersonation and intellectual property](https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property)
