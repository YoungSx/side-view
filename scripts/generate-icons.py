# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow==12.2.0"]
# ///
"""Export the approved artwork; normal extension builds use the checked-in PNGs."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
# Small browser icons use tighter padding; the store icon has a 96px artwork box.
ARTWORK_SIZES = {16: 14, 32: 28, 48: 42, 128: 96}


def main() -> None:
    with Image.open(ROOT / "assets/icon/source.png") as source:
        source = source.convert("RGBA")
        # Ignore nearly invisible alpha residue when locating the artwork. Keep
        # the original colors and alpha inside this crop, without redrawing it.
        bounds = source.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
        if bounds is None:
            raise ValueError("Icon source contains no visible artwork")
        artwork = source.crop(bounds)

    destination = ROOT / "public/icons"
    destination.mkdir(parents=True, exist_ok=True)
    for size, content_size in ARTWORK_SIZES.items():
        scaled = artwork.copy()
        # Pillow resizes RGBA through premultiplied alpha to avoid dark fringes.
        scaled.thumbnail((content_size, content_size), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        offset = ((size - scaled.width) // 2, (size - scaled.height) // 2)
        canvas.alpha_composite(scaled, offset)
        target = destination / f"{size}.png"
        canvas.save(target, optimize=True)
        print(f"{target.relative_to(ROOT)}: {size}x{size}, artwork {scaled.size}")


if __name__ == "__main__":
    main()
