#!/usr/bin/env python3
"""Pick the PixelLab UI options we use and write them to src/art/ui/.

Cleanup: trims empty borders, snaps every pixel onto the shared HEARTSEED palette so all the
pieces (and anything generated later) share exact colours, and dims the battle map so units
read on top of it. Change PICKS to swap in another of the generated options."""
import sys
from pathlib import Path
from PIL import Image, ImageEnhance
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixellab_ui import HEARTSEED, ICONS  # noqa: E402

SRC = Path(__file__).resolve().parent / 'pixellab-ui'
OUT = Path(__file__).resolve().parents[2] / 'src/art/ui'

PICKS = {
    'panel': 0, 'inset': 0, 'detail': 0,
    'btn_gold': 2, 'btn_moss': 1, 'btn_battle': 0, 'tab': 0,
    'hex_locked': 3, 'hex_open': 6, 'hex_owned': 0, 'hex_quest': 3, 'hex_seed': 0,
    'card_back': 0, 'card_common': 0, 'card_rare': 0, 'card_epic': 1, 'card_legendary': 2,
    'bar_frame': 1, 'boss_frame': 'bar_frame.3', 'spell_slot': 0,
}
BGS = {'bg_map': 23, 'bg_menu': 11}

PAL = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in HEARTSEED]


def snap(img):
    """Every opaque pixel onto the nearest palette colour; alpha becomes 0 or 255 (crisp pixels)."""
    img = img.convert('RGBA')
    px = img.load()
    cache = {}
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a < 128: px[x, y] = (0, 0, 0, 0); continue
            k = (r, g, b)
            if k not in cache:
                cache[k] = min(PAL, key=lambda p: (p[0] - r) ** 2 * 3 + (p[1] - g) ** 2 * 4 + (p[2] - b) ** 2 * 2)
            px[x, y] = (*cache[k], 255)
    return img


def trim(img):
    box = img.getbbox()
    return img.crop(box) if box else img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'icons').mkdir(exist_ok=True)
    for name, pick in PICKS.items():
        src = SRC / (f'{pick}.png' if isinstance(pick, str) else f'{name}.{pick}.png')
        trim(snap(Image.open(src))).save(OUT / f'{name}.png')
    for name in ICONS:
        trim(snap(Image.open(SRC / f'icon_{name}.0.png'))).save(OUT / 'icons' / f'{name}.png')
    # Hero thumbnails (first animation frame) for skill tree cells and cards.
    (OUT / 'heroes').mkdir(exist_ok=True)
    art = OUT.parent
    for h in ['ant', 'orbweaver', 'firefly', 'bee', 'bombardier', 'trapdoor', 'stag', 'mantis']:
        strip = Image.open(art / f'{h}.png').convert('RGBA')
        trim(strip.crop((0, 0, strip.width // 2, strip.height))).save(OUT / 'heroes' / f'{h}.png')
    m = Image.open(SRC / f'bg_map.{BGS["bg_map"]}.png').convert('RGB')
    m = ImageEnhance.Color(m).enhance(0.6)
    m = ImageEnhance.Brightness(m).enhance(0.5)
    m.save(OUT / 'bg_map.png')
    Image.open(SRC / f'bg_menu.{BGS["bg_menu"]}.png').convert('RGB').save(OUT / 'bg_menu.png')
    print('wrote', len(list(OUT.glob('*.png'))), 'pieces and', len(list((OUT / 'icons').glob('*.png'))), 'icons')


if __name__ == '__main__':
    main()
