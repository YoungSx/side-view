"""One-off: mask the logged-in account out of x.jpg and fit settings.png to 1280x800.

Run from the repo root with the source screenshots in SRC. Writes into
assets/store/screenshots/. Re-running overwrites the outputs; the sources in
Downloads are never modified.
"""

import os

from PIL import Image

SRC = r"C:\Users\shang\Downloads\side-view-screenshoot"
DST = os.path.join("assets", "store", "screenshots")

# --- x.jpg: fill the account row in the left nav -------------------------
# The nav background is a flat (1, 1, 1), so a solid fill leaves no trace and
# no mosaic edge. Measured content bbox of the identity block is
# (16, 752, 206, 786); the nav column ends at x=219. The box below is padded
# past that on all sides so antialiased glyph edges cannot survive.
X_MASK_BOX = (0, 744, 220, 800)
X_NAV_BG = (1, 1, 1)

# --- settings.png: drop the dead space to the right of the content --------
# Measured content ends at x=1946; a scrollbar occupies 2470..2489. Scaling to
# 800px tall yields 1562px wide, so cropping the right 282px lands entirely
# inside the dead zone and the scrollbar. Nothing is cut from the page itself
# and no padding is introduced.
SETTINGS_TARGET = (1280, 800)


def mask_x() -> None:
    im = Image.open(os.path.join(SRC, "x.jpg")).convert("RGB")
    assert im.size == (1280, 800), im.size
    fill = Image.new("RGB", (X_MASK_BOX[2] - X_MASK_BOX[0], X_MASK_BOX[3] - X_MASK_BOX[1]), X_NAV_BG)
    im.paste(fill, X_MASK_BOX[:2])
    out = os.path.join(DST, "01-x-sidebar.jpg")
    # Re-encoding an already-compressed JPEG: keep chroma full and quality
    # high so the single generation of loss stays invisible.
    im.save(out, "JPEG", quality=92, subsampling=0, optimize=True)
    print(f"01-x-sidebar.jpg  {im.size}  {os.path.getsize(out) / 1024:.0f} KB")


def fit_settings() -> None:
    im = Image.open(os.path.join(SRC, "settings.png")).convert("RGB")
    w, h = im.size
    scale = SETTINGS_TARGET[1] / h
    scaled_w = round(w * scale)
    im = im.resize((scaled_w, SETTINGS_TARGET[1]), Image.LANCZOS)
    assert scaled_w > SETTINGS_TARGET[0], scaled_w
    im = im.crop((0, 0, SETTINGS_TARGET[0], SETTINGS_TARGET[1]))
    # PNG on purpose: the page is flat near-black, exactly where JPEG banding
    # shows up. The three photographic screenshots stay JPEG.
    out = os.path.join(DST, "04-settings.png")
    im.save(out, "PNG", optimize=True)
    print(f"04-settings.png   {im.size}  {os.path.getsize(out) / 1024:.0f} KB  (from {w}x{h})")


def copy_through(name: str, out_name: str) -> None:
    im = Image.open(os.path.join(SRC, name)).convert("RGB")
    assert im.size == (1280, 800), (name, im.size)
    out = os.path.join(DST, out_name)
    im.save(out, "JPEG", quality=92, subsampling=0, optimize=True)
    print(f"{out_name}  {im.size}  {os.path.getsize(out) / 1024:.0f} KB")


if __name__ == "__main__":
    os.makedirs(DST, exist_ok=True)
    copy_through("bluesky.jpg", "02-bluesky-sidebar.jpg")
    copy_through("threads.jpg", "03-threads-native-column.jpg")
    mask_x()
    fit_settings()
