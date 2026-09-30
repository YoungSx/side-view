#!/usr/bin/env python3
"""Generate the extension's PNG icons into public/icon/.

The two bars are the product in one glyph: a narrow timeline column and a wider
detail column beside it. Re-run after editing the palette below:

    python3 scripts/make-icons.py

WXT picks up public/icon/{16,32,48,128}.png and fills in the manifest `icons` field.
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icon"
SIZES = (16, 32, 48, 128)

BG = (22, 24, 29, 255)
TIMELINE = (90, 100, 114, 255)
DETAIL = (59, 130, 246, 255)

SS = 8  # supersample factor; downsampled at the end for antialiasing


def render(size: int) -> Image.Image:
    n = size * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    d.rounded_rectangle((0, 0, n - 1, n - 1), radius=n * 0.22, fill=BG)

    pad = n * 0.17
    gap = n * 0.075
    inner = n - 2 * pad
    left_w = (inner - gap) * 0.36
    right_w = inner - gap - left_w
    radius = n * 0.045

    d.rounded_rectangle((pad, pad, pad + left_w, n - pad), radius=radius, fill=TIMELINE)
    right_x = pad + left_w + gap
    d.rounded_rectangle((right_x, pad, right_x + right_w, n - pad), radius=radius, fill=DETAIL)

    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUT / f"{size}.png"
        render(size).save(path)
        print(f"wrote {path}")
