#!/usr/bin/env python3
"""Erzeugt die PNG-Icons der Erweiterung (16/32/48/128 px) nur mit der Standardbibliothek.

Motiv: abgerundetes Quadrat mit Opera-GX-typischem Rot/Pink-Verlauf, darauf eine
weiße "Ablage" (Schale) mit einem Pfeil nach unten.

Aufruf:  python3 tools/make_icons.py      (schreibt nach extension/icons/)
"""
import os
import struct
import zlib

SIZES = (16, 32, 48, 128)
SS = 4  # Supersampling pro Achse (Kantenglättung)
TOP = (255, 61, 127)    # #ff3d7f
BOTTOM = (214, 18, 62)  # #d6123e
WHITE = (255, 255, 255)


def in_round_rect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def in_polygon(x, y, pts):
    inside = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def shape_white(u, v):
    """u, v in [0,1]: True, wenn der Punkt zum weißen Motiv gehört."""
    # Schale (U-Form): unterer Balken + zwei Seitenwände
    t = 0.085
    if in_round_rect(u, v, 0.20, 0.70, 0.80, 0.70 + t, 0.03):
        return True
    if in_round_rect(u, v, 0.20, 0.52, 0.20 + t, 0.78, 0.03):
        return True
    if in_round_rect(u, v, 0.80 - t, 0.52, 0.80, 0.78, 0.03):
        return True
    # Pfeil nach unten
    if in_round_rect(u, v, 0.455, 0.18, 0.545, 0.47, 0.02):
        return True
    if in_polygon(u, v, [(0.33, 0.43), (0.67, 0.43), (0.50, 0.62)]):
        return True
    return False


def render(size):
    rows = []
    for py in range(size):
        row = bytearray([0])  # Filter-Typ 0
        for px in range(size):
            bg = 0
            fg = 0
            for sy in range(SS):
                for sx in range(SS):
                    u = (px + (sx + 0.5) / SS) / size
                    v = (py + (sy + 0.5) / SS) / size
                    if in_round_rect(u, v, 0.02, 0.02, 0.98, 0.98, 0.22):
                        bg += 1
                        if shape_white(u, v):
                            fg += 1
            n = SS * SS
            v = (py + 0.5) / size
            base = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * v) for i in range(3))
            if bg == 0:
                row += bytes((0, 0, 0, 0))
                continue
            f = fg / bg
            col = tuple(round(base[i] * (1 - f) + WHITE[i] * f) for i in range(3))
            row += bytes((*col, round(255 * bg / n)))
        rows.append(bytes(row))
    return b"".join(rows)


def png(size, raw):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "extension", "icons")
    os.makedirs(out, exist_ok=True)
    for s in SIZES:
        path = os.path.join(out, f"icon{s}.png")
        with open(path, "wb") as fh:
            fh.write(png(s, render(s)))
        print("geschrieben:", os.path.normpath(path))


if __name__ == "__main__":
    main()
