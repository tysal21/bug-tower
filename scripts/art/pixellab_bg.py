#!/usr/bin/env python3
"""Battle map and menu backdrop from PixelLab pixflux, on the shared Heartseed palette.
Cached in scripts/art/pixellab-ui/bg_*.png. Usage: python3 scripts/art/pixellab_bg.py [name] [--force]"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixellab import call, unb64  # noqa: E402

CACHE = Path(__file__).resolve().parent / 'pixellab-ui'
BGS = {
    # 320x180 is drawn 4x to fill the 1280x720 arena.
    'bg_map': (320, 180, 'high top-down view of a quiet mossy forest floor clearing at dusk, soft bare earth patch in the '
               'center, short grass and clover, scattered fallen leaves, tiny mushrooms, pebbles and twigs and small flowers '
               'thicker near the edges, muted dark greens and browns, low contrast, game battle map background, no characters'),
    'bg_menu': (128, 128, 'seamless tileable texture of dark tree bark with faint moss, very dark brown and green, low contrast, subtle'),
}

for name, (w, h, desc) in BGS.items():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if args and name not in args: continue
    for seed in (11, 23):
        out = CACHE / f'{name}.{seed}.png'
        if out.exists() and '--force' not in sys.argv: continue
        body = {'description': desc, 'image_size': {'width': w, 'height': h}, 'view': 'high top-down',
                'shading': 'medium shading', 'detail': 'highly detailed', 'outline': 'lineless', 'seed': seed}
        unb64(call('POST', '/create-image-pixflux', body)['image']).save(out)
        print(name, seed)
