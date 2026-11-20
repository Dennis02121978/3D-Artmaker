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
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "orca")
LOGO = os.path.join(ROOT, "skipr-bootlogo", "logo.png")
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"

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


# Vorderfront wie am Drucker: Edelstahl-Blende mit Display, OLED und Schriftzug
FRONT_EXTRA = 60.0           # Blende ragt links und rechts so weit ueber die Platte
FRONT_GAP = 6.0              # Abstand Platte bis Oberkante Blende (Y)
FRONT_DEPTH = 42.0           # Schraege nach vorne (Y)
FRONT_DROP = 72.0            # Schraege nach unten (Z)
FRONT_TOP = -8.0             # Oberkante der Blende (Z)
FRONT_LIP = 14.0             # senkrechte Kante unten
CAP = 3.0                    # Endkappen links und rechts, so weit stehen sie vor
RELIEF_RES = 0.4             # mm je Pixel fuer Logo und Schrift


def oriented(tri, want):
    """Dreieck so drehen, dass seine Normale in Richtung want zeigt."""
    a, b, c = (np.asarray(p, float) for p in tri)
    if np.dot(np.cross(b - a, c - a), want) < 0:
        return (a, c, b)
    return (a, b, c)


def quad(tris, p0, p1, p2, p3, want):
    tris.append(oriented((p0, p1, p2), want))
    tris.append(oriented((p0, p2, p3), want))


def prism(tris, profile, x0, x1):
    """Gerades Prisma: konvexes Profil in Y/Z, von x0 bis x1 in X."""
    pts = [np.array(p, float) for p in profile]
    centre = np.mean(pts, axis=0)
    for x, sign in ((x0, -1.0), (x1, 1.0)):
        c3 = (x, centre[0], centre[1])
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            tris.append(oriented((c3, (x, *a), (x, *b)), (sign, 0, 0)))
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        edge = b - a
        out = np.array([edge[1], -edge[0]])
        if np.dot(out, (a + b) / 2 - centre) < 0:
            out = -out
        quad(tris, (x0, *a), (x1, *a), (x1, *b), (x0, *b), (0, out[0], out[1]))


SKIN = 3.0                   # Blech der Blende, Display und Schrift sind darin ausgeschnitten


def relief_map(width, length):
    """Hoehenkarte (mm) der schraegen Blende. Zeile 0 = Oberkante.

    Wie am Drucker: Display-Fenster und Schriftzug sind in das Blech
    ausgeschnitten, das Logo steht im Fenster, die Schrauben stehen vor.
    """
    W, L = round(width / RELIEF_RES), round(length / RELIEF_RES)
    img = Image.new("L", (W, L), 0)
    d = ImageDraw.Draw(img)
    px = lambda mm: round(mm / RELIEF_RES)
    level = lambda mm: round(mm * 50)         # Hoehe in 1/50 mm als Grauwert (max. 5 mm)

    d.rectangle([0, 0, W, L], fill=level(SKIN))
    # Display-Fenster mittig, Logo darin erhaben
    dw, dh = 80.0, 56.0
    cx, cy = width / 2, length * 0.43
    d.rectangle([px(cx - dw / 2), px(cy - dh / 2), px(cx + dw / 2), px(cy + dh / 2)], fill=0)
    logo = Image.open(LOGO).convert("L")
    logo = logo.crop(Image.eval(logo, lambda v: 255 if v < 235 else 0).getbbox())
    lw = px(dw - 10)
    lh = round(logo.height * lw / logo.width)
    if lh > px(dh - 8):
        lh = px(dh - 8)
        lw = round(logo.width * lh / logo.height)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    mask = logo.point(lambda v: 255 if v < 215 else 0).filter(ImageFilter.MedianFilter(3))
    img.paste(level(SKIN - 0.8), (px(cx) - lw // 2, px(cy) - lh // 2), mask)
    # Schrauben neben dem Display
    for sx_ in (cx - dw / 2 - 16, cx + dw / 2 + 16):
        for sy_ in (cy - dh / 2 + 4, cy + dh / 2 - 4):
            r = px(3.5)
            d.ellipse([px(sx_) - r, px(sy_) - r, px(sx_) + r, px(sy_) + r], fill=level(SKIN + 1.5))
    # Kleines OLED links oben
    ox, oy = width * 0.06, length * 0.30
    d.rectangle([px(ox), px(oy), px(ox + 28), px(oy + 16)], fill=level(SKIN - 1.5))
    # Schriftzug links unten, ausgeschnitten
    f = ImageFont.truetype(FONT_BLACK, px(11)) if os.path.exists(FONT_BLACK) else font(px(11))
    d.text((px(width * 0.05), px(length - 4.5)), "3D - Artmaker", font=f, fill=0, anchor="ls")
    return np.asarray(img).astype(np.float32) / 50.0


def relief(tris, hmap, origin, ex, ev, en):
    """Hoehenkarte als Relief auf eine Flaeche setzen.

    Die Kanten werden abgeschraegt (Hoehen an den Gitterpunkten gemittelt). Schraege
    Flaechen fangen das Licht anders, so sind Logo und Schrift in OrcaSlicer zu
    sehen, obwohl das Modell einfarbig ist. Ebene Bereiche werden je Zeile
    zusammengefasst, damit die Datei klein bleibt.
    """
    o, ex, ev, en = (np.asarray(v, float) for v in (origin, ex, ev, en))
    pad = np.pad(hmap, 1, mode="edge")
    hv = (pad[:-1, :-1] + pad[:-1, 1:] + pad[1:, :-1] + pad[1:, 1:]) / 4.0   # Gitterpunkte
    rows, cols = hmap.shape
    P = lambda u, v: o + u * RELIEF_RES * ex + v * RELIEF_RES * ev + hv[v, u] * en
    flat = (hv[:-1, :-1] == hv[:-1, 1:]) & (hv[:-1, :-1] == hv[1:, :-1]) & (hv[:-1, :-1] == hv[1:, 1:])
    for i in range(rows):
        j = 0
        while j < cols:
            if flat[i, j]:
                k = j
                while k < cols and flat[i, k] and hv[i, k] == hv[i, j]:
                    k += 1
                quad(tris, P(j, i), P(k, i), P(k, i + 1), P(j, i + 1), en)
                j = k
            else:
                a, b, c, d = P(j, i), P(j + 1, i), P(j + 1, i + 1), P(j, i + 1)
                tris.append(oriented((a, b, c), en))
                tris.append(oriented((a, c, d), en))
                j += 1


def front(tris, sx, sy):
    width = sx + 2 * FRONT_EXTRA
    x0, x1 = -width / 2, width / 2
    y_top = -sy / 2 - FRONT_GAP
    y_bot = y_top - FRONT_DEPTH
    z_top, z_bot = FRONT_TOP, FRONT_TOP - FRONT_DROP
    z_floor = z_bot - FRONT_LIP
    profile = [(y_top, z_top), (y_bot, z_bot), (y_bot, z_floor), (y_top + 30, z_floor), (y_top + 30, z_top)]
    prism(tris, profile, x0, x1)
    # Endkappen (am Drucker schwarzer Kunststoff)
    cap = [(y + dy, z + dz) for (y, z), (dy, dz) in zip(profile, [(CAP, CAP), (-CAP, -CAP * 0.5), (-CAP, -0.0), (CAP, 0.0), (CAP, CAP)])]
    prism(tris, cap, x0 - 8, x0)
    prism(tris, cap, x1, x1 + 8)
    # Relief auf der Schraege
    slope = np.array([0.0, y_bot - y_top, z_bot - z_top])
    length = float(np.linalg.norm(slope))
    ev = slope / length
    en = np.array([0.0, -ev[2], ev[1]])
    if en[1] > 0:
        en = -en
    relief(tris, relief_map(width, length), (x0, y_top, z_top), (1, 0, 0), ev, en * 1.0)


def stl(fname, x_mm, y_mm):
    """Platte mit runden Ecken und Vorderfront, um X/Y = 0 zentriert.

    OrcaSlicer verschiebt das Modell um die Mitte der Druckflaeche, die STL muss
    deshalb um den Nullpunkt liegen. Die Oberseite liegt knapp unter Z=0, damit
    sie nicht mit der Textur flimmert.
    """
    sx, sy = x_mm + 2 * MARGIN, y_mm + 2 * MARGIN
    ring = [(px - sx / 2, py - sy / 2) for px, py in rounded_outline(sx, sy, RADIUS)]
    top, bot = -TOP_GAP, -TOP_GAP - THICK
    tris = []
    n = len(ring)
    for i in range(n):
        a, b = ring[i], ring[(i + 1) % n]
        top_a, top_b = (a[0], a[1], top), (b[0], b[1], top)
        bot_a, bot_b = (a[0], a[1], bot), (b[0], b[1], bot)
        tris.append(((0.0, 0.0, top), top_a, top_b))          # Deckel
        tris.append(((0.0, 0.0, bot), bot_b, bot_a))          # Boden
        tris.append((bot_a, bot_b, top_b))                    # Seite
        tris.append((bot_a, top_b, top_a))
    front(tris, sx, sy)
    path = os.path.join(OUT, fname + "_bed.stl")
    arr = np.array([np.asarray(t, float) for t in tris], dtype=np.float32)
    nrm = np.cross(arr[:, 1] - arr[:, 0], arr[:, 2] - arr[:, 0])
    ln = np.linalg.norm(nrm, axis=1, keepdims=True)
    nrm = np.divide(nrm, ln, out=np.zeros_like(nrm), where=ln > 0)
    rec = np.zeros(len(arr), dtype=np.dtype([("n", "<f4", 3), ("v", "<f4", 9), ("a", "<u2")]))
    rec["n"], rec["v"] = nrm, arr.reshape(-1, 9)
    with open(path, "wb") as f:
        f.write(b"3D-Artmaker bed".ljust(80, b"\0"))
        f.write(struct.pack("<I", len(arr)))
        f.write(rec.tobytes())
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fname, x, y in MODELS:
        print(texture(name, fname, x, y))
        print(stl(fname, x, y))


if __name__ == "__main__":
    main()
