"""Cuts the Wots Office logo out of the brand mockup (assets/brand/mockup.png).

    python3 make_logo.py   -> assets/brand/logo-hero.png  (logo + blueprint lines, brand scene)
                              assets/brand/logo-mark.png  (just the W mark, end card)

The mockup's navy background is pulled down towards black and the edges are
feathered to black. Then each pixel's brightness becomes its opacity ("unscreen"),
so the PNG laid over any dark background looks like the logo glowing on it, with
no box around it.
"""
import os

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "assets", "brand", "mockup.png")
OUT = os.path.join(HERE, "assets", "brand")
BLACK = np.array([0, 16, 44], dtype=float)  # navy behind the logo -> black


def cut(box, feather, name):
    im = np.asarray(Image.open(SRC).convert("RGB").crop(box), dtype=float)
    im = np.clip((im - BLACK) / (255 - BLACK) * 255, 0, 255)
    h, w = im.shape[:2]
    y, x = np.mgrid[0:h, 0:w]
    # fade to black over the outer `feather` pixels so the crop has no hard edge
    ax = np.clip(np.minimum(x, w - 1 - x) / feather[0], 0, 1)
    ay = np.clip(np.minimum(y, h - 1 - y) / feather[1], 0, 1)
    a = (ax * ay) ** 1.2
    rgb = im * a[..., None]
    alpha = rgb.max(axis=2, keepdims=True)
    color = np.where(alpha > 0, rgb / np.maximum(alpha, 1e-6) * 255, 0)
    rgba = np.dstack([color, alpha]).round().astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, name), optimize=True)
    print("wrote", name, w, "x", h)


cut((0, 215, 941, 700), (60, 45), "logo-hero.png")
cut((10, 235, 931, 690), (40, 30), "logo-mark.png")
