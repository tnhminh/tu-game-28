#!/usr/bin/env python3
"""Generate Android (and iOS) launcher icons (legacy + adaptive + monochrome), notification
icon and splash images for Tủ Game 28.

Icon source, in priority order:
  1. --source PATH (explicit)
  2. hub/assets/icons/maskable-512.png (full-bleed maskable icon), then
     hub/assets/icons/icon-512.png (transparent logo)
  3. www/icons/maskable-512.png, www/icons/icon-512.png (produced by tools/build-www.mjs)
  4. Built-in original mark: a stylised gold (#ffc94a) joystick / game-cabinet
     emblem on #12131c, drawn here with Pillow (no third-party artwork).

Prints which source was used. Requires Pillow (python3 -m pip install pillow).
Usage: python3 android/scripts/gen-icons.py [--source PATH] [--root /home/user/games]
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

BG = (0x12, 0x13, 0x1C, 255)
GOLD = (0xFF, 0xC9, 0x4A, 255)
GOLD_DARK = (0xC8, 0x8E, 0x1E, 255)

DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def draw_mark(size, color=GOLD, shade=GOLD_DARK, bg=None):
    """Original joystick emblem, drawn inside the adaptive-icon safe zone.

    Canvas = 108dp; everything stays inside the central ~60dp circle."""
    S = 4 * size  # supersample
    im = Image.new("RGBA", (S, S), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = S / 108.0  # 1dp in supersampled px

    def r(x0, y0, x1, y1):
        return [x0 * u, y0 * u, x1 * u, y1 * u]

    # cabinet-style base: rounded slab with a lighter top face
    d.rounded_rectangle(r(28, 62, 80, 80), radius=7 * u, fill=shade)
    d.rounded_rectangle(r(28, 58, 80, 74), radius=7 * u, fill=color)
    # two arcade buttons on the base
    d.ellipse(r(58, 61, 66, 67), fill=bg or BG)
    d.ellipse(r(68, 61, 76, 67), fill=bg or BG)
    # stick collar
    d.ellipse(r(37, 61, 53, 69), fill=bg or BG)
    # stick shaft
    d.rounded_rectangle(r(42.5, 38, 47.5, 66), radius=2.5 * u, fill=color)
    # ball top
    d.ellipse(r(33, 24, 57, 48), fill=color)
    # highlight on the ball (cut-out crescent, reads as a shine)
    d.ellipse(r(38, 29, 45, 36), fill=bg or BG)
    d.ellipse(r(39.5, 30.5, 46.5, 37.5), fill=color)
    # small "spark" star top-right (game collection flair)
    cx, cy, a, b = 70, 34, 8, 2.4
    pts = [(cx, cy - a), (cx + b, cy - b), (cx + a, cy), (cx + b, cy + b),
           (cx, cy + a), (cx - b, cy + b), (cx - a, cy), (cx - b, cy - b)]
    d.polygon([(x * u, y * u) for x, y in pts], fill=color)
    return im.resize((size, size), Image.LANCZOS)


def load_source(root, explicit):
    cands = [explicit] if explicit else [
        os.path.join(root, "hub/assets/icons/maskable-512.png"),
        os.path.join(root, "hub/assets/icons/icon-512.png"),
        os.path.join(root, "www/icons/maskable-512.png"),
        os.path.join(root, "www/icons/icon-512.png"),
    ]
    for c in cands:
        if c and os.path.isfile(c):
            try:
                im = Image.open(c).convert("RGBA")
                if min(im.size) >= 192:
                    return c, im
            except Exception as e:  # noqa
                print(f"  ignoring {c}: {e}", file=sys.stderr)
    return None, None


def is_opaque(im):
    return im.getextrema()[3][0] == 255


def foreground_from_source(src, size):
    """Place a square raster icon into the adaptive foreground (108dp canvas).
    * Opaque / maskable (full-bleed) art: its W3C safe circle is the inner 80%,
      so we scale it to 90dp → that circle == the 72dp visible area; the
      background layer (same colour as the art's corner) fills the rest.
    * Transparent logo: scaled to 62dp so it sits inside the 66dp safe zone."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = round(size * (90 if is_opaque(src) else 62) / 108)
    art = src.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    canvas.alpha_composite(art, (off, off))
    return canvas


def silhouette_alpha(img, lo):
    """Alpha mask of the bright motif: pixels brighter than `lo` (ramp of ~25
    levels) are kept, darker backgrounds/cut-outs drop out."""
    from PIL import ImageChops
    lum = img.convert("RGB").convert("L").point(lambda v: max(0, min(255, (v - lo) * 10)))
    lum = lum.filter(ImageFilter.MedianFilter(5)) if img.size[0] >= 200 else lum
    return ImageChops.multiply(img.split()[3], lum)


MONO_LO = 50  # threshold for the built-in mark; raised for raster hub art (gradient bg)


def monochrome(fg):
    """Android 13 themed icon: alpha-only silhouette (system tints it)."""
    a = silhouette_alpha(fg, MONO_LO)
    # drop anything outside the visible 72dp area (e.g. glows in raster art)
    from PIL import ImageChops
    n = fg.size[0]
    keep = Image.new("L", fg.size, 0)
    ImageDraw.Draw(keep).ellipse([n * 19 / 108, n * 19 / 108, n * 89 / 108, n * 89 / 108], fill=255)
    a = ImageChops.multiply(a, keep)
    out = Image.new("RGBA", fg.size, (255, 255, 255, 0))
    out.putalpha(a)
    return out


def legacy(fg_full, bg_color, size, round_mask):
    """Legacy (pre-API-26) launcher icon from the 108dp foreground."""
    big = 432
    base = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    m = Image.new("L", (big, big), 0)
    md = ImageDraw.Draw(m)
    pad = round(big * 4 / 108)  # small margin like the 48dp grid
    if round_mask:
        md.ellipse([pad, pad, big - pad, big - pad], fill=255)
    else:
        md.rounded_rectangle([pad, pad, big - pad, big - pad], radius=big * 0.18, fill=255)
    tile = Image.new("RGBA", (big, big), bg_color)
    # crop the 108dp foreground to its visible 72dp-ish region → 100dp to fit
    fg = fg_full.resize((round(big * 108 / 84), round(big * 108 / 84)), Image.LANCZOS)
    off = (big - fg.size[0]) // 2
    tile.alpha_composite(fg, (off, off))
    base.paste(tile, (0, 0), m)
    return base.resize((size, size), Image.LANCZOS)


def splash_motif(fg_full, raster):
    """What to put on a splash screen: the built-in mark as-is, or for raster
    (full-bleed) art the visible 72dp area as a rounded tile."""
    if not raster:
        return fg_full
    n = fg_full.size[0]
    c = round(n * 18 / 108)
    tile = fg_full.crop((c, c, n - c, n - c))
    m = Image.new("L", tile.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, tile.size[0] - 1, tile.size[1] - 1], radius=tile.size[0] * 0.22, fill=255)
    out = Image.new("RGBA", tile.size, (0, 0, 0, 0))
    out.paste(tile, (0, 0), m)
    return out


def splash(w, h, motif, bg_color, frac=0.55):
    im = Image.new("RGBA", (w, h), bg_color)
    s = round(min(w, h) * frac)
    fg = motif.resize((s, s), Image.LANCZOS)
    im.alpha_composite(fg, ((w - s) // 2, (h - s) // 2))
    return im.convert("RGB")


def notif_icon_from(fg_full, size):
    """Notification icon from raster art: white silhouette of the bright motif,
    cropped to its bounding box (status-bar icons must be white + alpha)."""
    a = silhouette_alpha(fg_full, MONO_LO)
    n = fg_full.size[0]
    c = round(n * 18 / 108)
    a = a.crop((c, c, n - c, n - c))  # only what is visible on the launcher
    bbox = a.point(lambda v: 255 if v > 128 else 0).getbbox() or (0, 0) + a.size
    x0, y0, x1, y1 = bbox
    side = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    pad = side * 0.04
    box = (round(cx - side / 2 - pad), round(cy - side / 2 - pad), round(cx + side / 2 + pad), round(cy + side / 2 + pad))
    a = a.crop(box)
    out = Image.new("RGBA", a.size, (255, 255, 255, 0))
    out.putalpha(a)
    return out.resize((size, size), Image.LANCZOS)


def notif_icon(size):
    im = draw_mark(size * 4, color=(255, 255, 255, 255), shade=(255, 255, 255, 255), bg=None)
    # punch-outs were drawn with BG colour; turn them transparent
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r_, g, b, a = px[x, y]
            if a and r_ < 128:
                px[x, y] = (255, 255, 255, 0)
    # crop the 108dp art so the emblem fills the 24dp notification icon
    c = im.size[0]
    box = (round(c * 20 / 108), round(c * 18 / 108), round(c * 88 / 108), round(c * 86 / 108))
    return im.crop(box).resize((size, size), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    ap.add_argument("--source")
    a = ap.parse_args()
    res = os.path.join(a.root, "android/app/src/main/res")
    src_path, src = load_source(a.root, a.source)
    global MONO_LO
    bg_color = BG  # adaptive background layer + splash/legacy backgrounds
    raster = src is not None
    if raster:
        print(f"[icons] source: {src_path}")
        if is_opaque(src):
            # full-bleed art: background layer = mean of the art's border so the
            # (normally hidden) rim blends in during launcher parallax
            border = src.convert("RGB").resize((16, 16), Image.BOX)
            ring = [border.getpixel((x, y)) for x in range(16) for y in range(16) if x in (0, 15) or y in (0, 15)]
            bg_color = tuple(sum(p[i] for p in ring) // len(ring) for i in range(3)) + (255,)
        MONO_LO = 105
        make_fg = lambda n: foreground_from_source(src, n)
    else:
        print("[icons] source: built-in original joystick mark (gold #ffc94a on #12131c)")
        make_fg = lambda n: draw_mark(n)
    fg_master = make_fg(432 * 2)
    motif = splash_motif(fg_master, raster)
    notif = (lambda n: notif_icon_from(fg_master, n)) if raster else notif_icon

    for dname, k in DENS.items():
        mip = os.path.join(res, f"mipmap-{dname}")
        os.makedirs(mip, exist_ok=True)
        fsz = round(108 * k)
        fg = fg_master.resize((fsz, fsz), Image.LANCZOS)
        fg.save(os.path.join(mip, "ic_launcher_foreground.png"))
        monochrome(fg).save(os.path.join(mip, "ic_launcher_monochrome.png"))
        lsz = round(48 * k)
        legacy(fg_master, bg_color, lsz, False).save(os.path.join(mip, "ic_launcher.png"))
        legacy(fg_master, bg_color, lsz, True).save(os.path.join(mip, "ic_launcher_round.png"))
        dr = os.path.join(res, f"drawable-{dname}")
        os.makedirs(dr, exist_ok=True)
        notif(round(24 * k)).save(os.path.join(dr, "ic_stat_notify.png"))
        # Android 12+ splash icon: 288dp canvas, icon inside inner 192dp circle
        ssz = round(288 * k)
        sp = Image.new("RGBA", (ssz, ssz), (0, 0, 0, 0))
        inner = round(ssz * 192 / 288 * 108 / 72)  # foreground's 72dp visible area → 192dp
        sp.alpha_composite(fg_master.resize((inner, inner), Image.LANCZOS), ((ssz - inner) // 2,) * 2)
        sp.save(os.path.join(dr, "splash_icon.png"))

    # legacy full-screen splash (used by @capacitor/splash-screen < Android 12)
    sizes = {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280),
             "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}
    for dname, (w, h) in sizes.items():
        for orient, (W, H) in (("port", (w, h)), ("land", (h, w))):
            p = os.path.join(res, f"drawable-{orient}-{dname}")
            os.makedirs(p, exist_ok=True)
            splash(W, H, motif, BG).save(os.path.join(p, "splash.png"), optimize=True)
    splash(480, 320, motif, BG).save(os.path.join(res, "drawable/splash.png"), optimize=True)

    hexbg = "#%02X%02X%02X" % bg_color[:3]
    with open(os.path.join(res, "values/ic_launcher_background.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                f'    <color name="ic_launcher_background">{hexbg}</color>\n</resources>\n')
    def full_icon(n):
        """Square, opaque, full-bleed icon (Play hi-res icon, iOS App Store icon)."""
        if raster and is_opaque(src):
            return src.convert("RGB").resize((n, n), Image.LANCZOS)
        im = Image.new("RGBA", (n, n), bg_color)
        fg = fg_master.resize((round(n * 108 / 76),) * 2, Image.LANCZOS)
        o = (n - fg.size[0]) // 2
        im.alpha_composite(fg, (o, o))
        return im.convert("RGB")

    # store-listing hi-res icon (512x512, no alpha) for Play Console
    out = os.path.join(a.root, "android/store-icon-512.png")
    full_icon(512).save(out)
    # iOS (if the Capacitor iOS project exists): 1024 app icon (opaque) + 2732 splash
    xc = os.path.join(a.root, "ios/App/App/Assets.xcassets")
    if os.path.isdir(xc):
        full_icon(1024).save(os.path.join(xc, "AppIcon.appiconset/AppIcon-512@2x.png"))
        sp = splash(2732, 2732, motif, BG, frac=0.30)
        for n in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
            sp.save(os.path.join(xc, "Splash.imageset", n), optimize=True)
        print("[icons] wrote iOS AppIcon (1024) and Splash (2732) images")
    print(f"[icons] wrote launcher/adaptive/monochrome/notification/splash resources; Play hi-res icon: {out}")


if __name__ == "__main__":
    main()
