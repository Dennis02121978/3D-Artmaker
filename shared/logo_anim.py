#!/usr/bin/python3
"""Animiertes Bootlogo fuer das 480x320-SPI-Display (RGB565).

Ablauf: Das Logo erscheint ohne die Linie durch die 3D und ohne den Schwung unter "Artmaker".
Dann laeuft die Linie einmal von links nach rechts durch, danach wird der Schwung gezeichnet.
Am Ende steht exakt das Original-Logo auf dem Display.

  logo_anim.py build LOGO.png ANIM.bin [VORSCHAU-ORDNER]   Animation berechnen (braucht python3-pil, python3-numpy)
  logo_anim.py play /dev/fb1 ANIM.bin [STATISCHES-LOGO.rgb565]   Animation abspielen (nur Python 3)

Fehlt ANIM.bin, wird das statische Logo geschrieben.
"""
import os
import struct
import sys
import time

W, H = 480, 320
MAGIC = b"RFLA1"

# --- Bereiche im Logo (in Pixeln) ---
LINE_X0, LINE_X1 = 52, 316          # waagerechte Linie durch die 3D
LINE_Y0, LINE_Y1 = 89, 98           # Zeilen der Linie ueber den Buchstaben (88 und 99 dienen als Anker)
GLOW_Y0, GLOW_Y1 = 79, 109          # Schein der Linie auf weissem Grund (78 und 110 dienen als Anker)
SW_X0, SW_X1 = 158, 312             # Schwung unter "Artmaker" samt Schatten
SW_Y0, SW_Y1 = 262, 304
SW_HOOK_X, SW_HOOK_Y = 238, 279     # ab hier gehoert der Strich zum Haken (rueckwaerts gezeichnet)
SW_END_X = 300

LINE_STEPS, SWASH_STEPS = 16, 24
FRAME_MS = 45
START_PAUSE_MS, MID_PAUSE_MS = 350, 250


def to565(rgb):
    import numpy as np
    a = rgb.astype(np.int32)
    return (((a[..., 0] >> 3) << 11) | ((a[..., 1] >> 2) << 5) | (a[..., 2] >> 3)).astype("<u2")


def build(png, out, preview=None):
    import numpy as np
    from PIL import Image

    img = Image.open(png).convert("RGB")
    if img.size != (W, H):
        sys.exit("Das Logo muss %dx%d Pixel gross sein." % (W, H))
    orig = to565(np.asarray(img))
    rgb = np.asarray(img).astype(np.float32)

    # --- saubere Ausgangsversion ---
    clean_rgb = rgb.copy()
    # Spalten mit weissem Grund ueber und unter der Linie: ganzer Schein weg. Sonst nur die Linie selbst.
    white = (rgb[GLOW_Y0 - 1].min(axis=1) >= 240) & (rgb[GLOW_Y1 + 1].min(axis=1) >= 240)
    for x in range(LINE_X0, LINE_X1):
        y0, y1 = (GLOW_Y0, GLOW_Y1) if white[x] else (LINE_Y0, LINE_Y1)
        a0, a1 = rgb[y0 - 1, x], rgb[y1 + 1, x]
        for y in range(y0, y1 + 1):
            t = (y - (y0 - 1)) / float(y1 + 1 - (y0 - 1))
            clean_rgb[y, x] = a0 * (1 - t) + a1 * t
    for y in range(SW_Y0, SW_Y1 + 1):
        f = min(1.0, max(0.0, (y - (SW_Y0 - 1)) / 4.0))
        seg = clean_rgb[y, SW_X0:SW_X1]
        clean_rgb[y, SW_X0:SW_X1] = seg * (1 - f) + 255.0 * f
    clean = to565(np.clip(clean_rgb + 0.5, 0, 255).astype(np.uint8))

    cur = clean.copy()
    frames = []  # (delay_ms, [(row, x0, x1)])

    def emit(delay, mask):
        """Pixel aus der Maske vom Original uebernehmen und die geaenderten Zeilenabschnitte merken."""
        spans = []
        changed = mask & (cur != orig)
        for y in np.where(changed.any(axis=1))[0]:
            xs = np.where(changed[y])[0]
            cur[y, xs] = orig[y, xs]
            spans.append((int(y), int(xs.min()), int(xs.max()) + 1))
        frames.append((delay, spans))

    yy, xx = np.mgrid[0:H, 0:W]

    # --- Schritt 1: Linie laeuft von links nach rechts durch ---
    band = (yy >= GLOW_Y0) & (yy <= GLOW_Y1) & (xx >= LINE_X0) & (xx < LINE_X1)
    for k in range(1, LINE_STEPS + 1):
        x_end = LINE_X0 + (LINE_X1 - LINE_X0) * k / LINE_STEPS
        emit(START_PAUSE_MS if k == 1 else FRAME_MS, band & (xx < x_end))

    # --- Schritt 2: Schwung wird gezeichnet ---
    box = (yy >= SW_Y0) & (yy <= SW_Y1) & (xx >= SW_X0) & (xx < SW_X1)
    hook = box & (yy >= SW_HOOK_Y) & (xx >= SW_HOOK_X)
    s = np.where(
        hook,
        0.65 + 0.35 * np.clip((SW_END_X - xx) / float(SW_END_X - SW_HOOK_X), 0, 1),
        0.65 * np.clip((xx - SW_X0) / float(SW_END_X - SW_X0), 0, 1),
    )
    for k in range(1, SWASH_STEPS + 1):
        emit(MID_PAUSE_MS if k == 1 else FRAME_MS, box & (s <= k / float(SWASH_STEPS)))

    if not (cur == orig).all():
        sys.exit("Interner Fehler: Endbild weicht vom Original ab.")

    with open(out, "wb") as f:
        f.write(MAGIC)
        f.write(clean.tobytes())
        f.write(struct.pack("<H", len(frames)))
        for delay, spans in frames:
            f.write(struct.pack("<HH", delay, len(spans)))
            for y, x0, x1 in spans:
                f.write(struct.pack("<IH", (y * W + x0) * 2, (x1 - x0) * 2))
                f.write(orig[y, x0:x1].tobytes())
    print("Animation: %d Bilder, %d Bytes, Endbild = Original" % (len(frames), os.path.getsize(out)))

    if preview:
        os.makedirs(preview, exist_ok=True)
        state = clean.copy()

        def save(name):
            r = ((state >> 11) & 31) << 3
            g = ((state >> 5) & 63) << 2
            b = (state & 31) << 3
            Image.fromarray(np.stack([r, g, b], axis=-1).astype("uint8")).save(os.path.join(preview, name))

        save("00_start.png")
        picks = {LINE_STEPS // 2: "01_linie_halb.png", LINE_STEPS: "02_linie_fertig.png",
                 LINE_STEPS + SWASH_STEPS // 3: "03_schwung_drittel.png",
                 LINE_STEPS + SWASH_STEPS * 2 // 3: "04_schwung_zweidrittel.png",
                 LINE_STEPS + SWASH_STEPS: "05_ende.png"}
        for i, (delay, spans) in enumerate(frames, 1):
            for y, x0, x1 in spans:
                state[y, x0:x1] = orig[y, x0:x1]
            if i in picks:
                save(picks[i])


def play(dev, anim, static=None):
    fd = os.open(dev, os.O_WRONLY)
    try:
        try:
            with open(anim, "rb") as f:
                data = f.read()
            if data[:5] != MAGIC:
                raise ValueError("falsches Format")
            pos = 5
            os.pwrite(fd, data[pos:pos + W * H * 2], 0)
            pos += W * H * 2
            (n,) = struct.unpack_from("<H", data, pos)
            pos += 2
            for _ in range(n):
                delay, ns = struct.unpack_from("<HH", data, pos)
                pos += 4
                time.sleep(delay / 1000.0)
                for _ in range(ns):
                    off, ln = struct.unpack_from("<IH", data, pos)
                    pos += 6
                    os.pwrite(fd, data[pos:pos + ln], off)
                    pos += ln
            return
        except (OSError, ValueError, struct.error):
            pass
        if static:
            with open(static, "rb") as f:
                os.pwrite(fd, f.read(W * H * 2), 0)
    finally:
        os.close(fd)


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) >= 3 and a[0] == "build":
        build(a[1], a[2], a[3] if len(a) > 3 else None)
    elif len(a) >= 3 and a[0] == "play":
        play(a[1], a[2], a[3] if len(a) > 3 else None)
    else:
        sys.exit(__doc__)
