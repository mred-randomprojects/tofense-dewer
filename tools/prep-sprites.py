"""Turn ChatGPT sprites in art/ into game-ready PNGs in assets/.

    python3 tools/prep-sprites.py

For every art/<name>.png whose name the game knows (see ASSETS in js/render.js):
removes the magenta (#FF00FF) background (and near-magenta anti-aliased edges),
trims empty borders, scales down to a sensible size, writes assets/<name>.png,
and rewrites assets/index.json so the game only requests sprites that exist.
"""

import json
import os
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "art")
ASSETS = os.path.join(ROOT, "assets")
MAX_WIDTH = 160  # px; the game draws sprites ~24-64px wide (x2-3 for sharp phones)


def known_names():
    src = open(os.path.join(ROOT, "js", "render.js")).read()
    block = src[src.index("export const ASSETS") :]
    block = block[: block.index("};")]
    return set(re.findall(r"(\w+): \{ w:", block))


def key_magenta(img):
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # distance from pure magenta; fade out near-magenta edge pixels
            d = max(abs(r - 255), g, abs(b - 255))
            if d < 60:
                px[x, y] = (r, g, b, 0)
            elif d < 110:
                alpha = int(255 * (d - 60) / 50)
                # remove the pink tint from edge pixels
                px[x, y] = (min(r, g + 60), g, min(b, g + 60), min(a, alpha))
    return img


def main():
    names = known_names()
    os.makedirs(ASSETS, exist_ok=True)
    done = []
    for f in sorted(os.listdir(ART)):
        name, ext = os.path.splitext(f)
        if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp") or name not in names:
            continue
        img = key_magenta(Image.open(os.path.join(ART, f)))
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        if img.width > MAX_WIDTH:
            img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
        img.save(os.path.join(ASSETS, f"{name}.png"))
        done.append(name)
        print(f"  {f} -> assets/{name}.png ({img.width}x{img.height})")
    existing = sorted(n for n in names if os.path.exists(os.path.join(ASSETS, f"{n}.png")))
    with open(os.path.join(ASSETS, "index.json"), "w") as fh:
        json.dump(existing, fh)
    skipped = [f for f in os.listdir(ART) if os.path.splitext(f)[0] not in names and not f.endswith(".md")]
    print(f"{len(done)} sprite(s) prepared; assets/index.json lists {len(existing)}.")
    if skipped:
        print("ignored (unknown names):", ", ".join(skipped), "— expected one of:", ", ".join(sorted(names)))


if __name__ == "__main__":
    main()
