#!/usr/bin/env python3
"""Erzeugt Bett-Modell (STL) und Bett-Textur (PNG) fuer OrcaSlicer.

Aufruf im Repo-Ordner:  python3 tools/make_orca_beds.py
Ergebnis in orca/:      <Modell>_bed.stl und <Modell>_texture.png

OrcaSlicer zieht die Textur auf die Druckflaeche (Printable area) und verschiebt
das Modell um deren Mitte, die STL liegt deshalb um X/Y = 0. Die Masse kommen aus installer/rf_generator.js
(Klipper, ein Extruder).
"""
import os
import struct

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "orca")
LOGO = os.path.join(ROOT, "skipr-bootlogo", "logo.png")
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

# Name, Dateiname, Druckflaeche X x Y in mm
MODELS = [
    ("RF1000", "RF1000", 240, 245),
    ("RF2000", "RF2000", 200, 245),
    ("RF2000 v2", "RF2000v2", 200, 295),
]

PX_PER_MM = 8
BED = (214, 218, 224)        # helles Aluminium-Grau
GRID_10 = (190, 195, 203)
GRID_50 = (150, 157, 168)
TEXT = (120, 128, 148)       # Gedecktes Blau, stoert die Vorschau nicht
LOGO_OPACITY = 0.45          # Logo halb durchsichtig, gedruckte Teile bleiben gut sichtbar

MARGIN = 8.0                 # Rand der Platte um die Druckflaeche in mm
THICK = 4.0
RADIUS = 6.0
TOP_GAP = 0.05              # Oberseite der Platte unter der Textur in mm


def font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default()


def logo_layer(width):
    """Logo ohne weissen Hintergrund: Weiss wird durchsichtig."""
    img = Image.open(LOGO).convert("RGB")
    bbox = Image.eval(img.convert("L"), lambda v: 255 if v < 235 else 0).getbbox()
    img = img.crop(bbox)
    rgb = np.asarray(img).astype(np.float32)
    alpha = np.clip((255.0 - rgb.min(axis=2)) * 1.6, 0, 255) * LOGO_OPACITY
    rgba = np.dstack([rgb, alpha]).astype(np.uint8)
    out = Image.fromarray(rgba, "RGBA")
    height = round(out.height * width / out.width)
    return out.resize((width, height), Image.LANCZOS)


def texture(name, fname, x_mm, y_mm):
    w, h = x_mm * PX_PER_MM, y_mm * PX_PER_MM
    img = Image.new("RGBA", (w, h), BED + (255,))
    d = ImageDraw.Draw(img)
    # Raster: Y=0 (vorne) ist unten im Bild
    for mm in range(0, x_mm + 1, 10):
        x = min(mm * PX_PER_MM, w - 1)
        d.line([(x, 0), (x, h)], fill=GRID_50 if mm % 50 == 0 else GRID_10,
               width=3 if mm % 50 == 0 else 1)
    for mm in range(0, y_mm + 1, 10):
        y = max(h - 1 - mm * PX_PER_MM, 0)
        d.line([(0, y), (w, y)], fill=GRID_50 if mm % 50 == 0 else GRID_10,
               width=3 if mm % 50 == 0 else 1)
    small = font(4 * PX_PER_MM)
    for mm in range(50, x_mm, 50):
        d.text((mm * PX_PER_MM + 6, h - 6), str(mm), font=small, fill=GRID_50, anchor="lb")
    for mm in range(50, y_mm, 50):
        d.text((6, h - mm * PX_PER_MM - 6), str(mm), font=small, fill=GRID_50, anchor="lb")

    logo = logo_layer(round(w * 0.72))
    lx = (w - logo.width) // 2
    ly = round(h * 0.42 - logo.height / 2)
    img.alpha_composite(logo, (lx, ly))
    big = font(round(11 * PX_PER_MM))
    d.text((w // 2, ly + logo.height + 6 * PX_PER_MM), name, font=big, fill=TEXT, anchor="mt")
    path = os.path.join(OUT, fname + "_texture.png")
    img.convert("RGB").save(path, optimize=True)
    return path


def rounded_outline(x, y, r, steps=8):
    pts = []
    for cx, cy, a0 in ((x - r, r, -90), (x - r, y - r, 0), (r, y - r, 90), (r, r, 180)):
        for i in range(steps + 1):
            a = np.radians(a0 + 90 * i / steps)
            pts.append((cx + r * np.cos(a), cy + r * np.sin(a)))
    return pts


def stl(fname, x_mm, y_mm):
    """Platte mit runden Ecken, um X/Y = 0 zentriert.

    OrcaSlicer verschiebt das Modell um die Mitte der Druckflaeche, die STL muss
    deshalb um den Nullpunkt liegen. Die Oberseite liegt knapp unter Z=0, damit
    sie nicht mit der Textur flimmert.
    """
    sx, sy = x_mm + 2 * MARGIN, y_mm + 2 * MARGIN
    ring = [(px - sx / 2, py - sy / 2) for px, py in rounded_outline(sx, sy, RADIUS)]
    cx, cy = 0.0, 0.0
    top, bot = -TOP_GAP, -TOP_GAP - THICK
    tris = []
    n = len(ring)
    for i in range(n):
        a, b = ring[i], ring[(i + 1) % n]
        top_a, top_b = (a[0], a[1], top), (b[0], b[1], top)
        bot_a, bot_b = (a[0], a[1], bot), (b[0], b[1], bot)
        tris.append(((cx, cy, top), top_a, top_b))            # Deckel
        tris.append(((cx, cy, bot), bot_b, bot_a))         # Boden
        tris.append((bot_a, bot_b, top_b))                    # Seite
        tris.append((bot_a, top_b, top_a))
    path = os.path.join(OUT, fname + "_bed.stl")
    with open(path, "wb") as f:
        f.write(b"3D-Artmaker bed".ljust(80, b"\0"))
        f.write(struct.pack("<I", len(tris)))
        for t in tris:
            v = np.array(t)
            nrm = np.cross(v[1] - v[0], v[2] - v[0])
            ln = np.linalg.norm(nrm)
            nrm = nrm / ln if ln else nrm
            f.write(struct.pack("<12fH", *nrm, *v[0], *v[1], *v[2], 0))
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fname, x, y in MODELS:
        print(texture(name, fname, x, y))
        print(stl(fname, x, y))


if __name__ == "__main__":
    main()
