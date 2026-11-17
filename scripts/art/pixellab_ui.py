#!/usr/bin/env python3
"""Generate Heartseed's UI art with PixelLab's Generate UI tool (/generate-ui-v2).

Every piece is drawn on the shared HEARTSEED palette below so the menus and HUD match the
sprites. Raw outputs are cached in scripts/art/pixellab-ui/; finished pieces go to src/art/ui/.

Usage:
  python3 scripts/art/pixellab_ui.py                 # everything not cached
  python3 scripts/art/pixellab_ui.py panel --force   # redo some pieces
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixellab import call, wait_job, unb64  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'scripts/art/pixellab-ui'

# Bark, moss, honey-gold, cream, berry, blight purple, rare blue, spell teal.
HEARTSEED = ['#140f0c', '#2a1d16', '#4a2c1e', '#6e4426', '#9a6a3a',
             '#1b2414', '#2c3a1e', '#46692c', '#7c9342', '#aecb50',
             '#7a4a12', '#c88a2a', '#f2c94c', '#fdf2a8', '#f0e6d2',
             '#b03135', '#5e1f2d', '#71295e', '#a855f7', '#2f5f9e',
             '#60a5fa', '#1f6f5f', '#6ee7b7', '#ffffff']

STYLE = ('hand-crafted pixel art game UI for a cozy garden insect fantasy game, '
         'carved dark bark wood with moss and honey-gold trim, crisp 1px dark outline, no text, no letters')

# name: (width, height, description)
PIECES = {
    # 1. panels and frames
    'panel': (96, 96, 'square window frame border made of dark carved bark wood, thin gold inlay line, small leaves at the four corners, dark mossy green flat empty center'),
    'inset': (64, 64, 'small recessed slot frame, thin dark wood rim with a soft gold edge, very dark empty center'),
    'detail': (96, 64, 'wide dialogue box frame, dark bark wood border with gold rivets in the corners, dark flat empty center'),
    # 2. buttons
    'btn_gold': (96, 32, 'wide rectangular button made of polished honey gold with a lighter top bevel and darker bottom edge, empty face'),
    'btn_moss': (96, 32, 'wide rectangular button made of mossy green wood with a lighter top bevel and darker bottom edge, empty face'),
    'btn_battle': (160, 56, 'big chunky call to action button, glossy berry red with a gold rim and a thick darker bottom edge, empty face'),
    'tab': (80, 28, 'rectangular tab button, dark wood with a thin gold top edge, empty face'),
    # 3. skill cells
    'hex_locked': (64, 56, 'flat-top hexagon tile made of cracked dark grey stone, dim, empty center'),
    'hex_open': (64, 56, 'flat-top hexagon tile made of dark bark wood with a thin moss green rim, empty center'),
    'hex_owned': (64, 56, 'flat-top hexagon tile made of honeycomb wax with a glowing gold rim, empty center'),
    'hex_quest': (64, 56, 'flat-top hexagon tile with a dashed gold rope border and an old parchment center, empty'),
    'hex_seed': (80, 80, 'round circular medallion of carved wood with a bright leafy green ring, empty center'),
    # 4. card frames
    'card_back': (96, 132, 'back of a trading card, dark purple with a golden honeycomb pattern and a seed emblem in the middle, gold border'),
    'card_common': (96, 132, 'trading card frame border, plain carved oak wood, thin, empty transparent center window'),
    'card_rare': (96, 132, 'trading card frame border, blue enamel and silver filigree, empty transparent center window'),
    'card_epic': (96, 132, 'trading card frame border, purple amethyst crystals set in dark wood, empty transparent center window'),
    'card_legendary': (96, 132, 'trading card frame border, ornate gold with leaves and a small crown at the top, empty transparent center window'),
    # 5. HUD
    'bar_frame': (128, 16, 'long thin horizontal health bar frame, dark wood with gold end caps, empty dark inside'),
    'boss_frame': (192, 20, 'long thin horizontal boss health bar frame, dark thorny vines with a small frog crown ornament in the middle, empty dark inside'),
    'spell_slot': (48, 48, 'square spell slot frame, dark stone with teal glowing runes in the corners, empty center'),
}

# Small icons are drawn with pixflux (1 generation each instead of 10) on the same palette.
# Key = icon file name in src/art/ui/icons/; tree nodes, spells and currencies point at these.
ICONS = {
    'gold': 'a shiny gold coin with a leaf stamped on it',
    'mastery': 'a glowing light blue four-pointed star crystal',
    'nectar': 'a single fat drop of golden honey nectar',
    'foil': 'a round shiny silver foil medallion with a sparkle',
    'holo': 'an iridescent rainbow holographic faceted gem',
    'seed': 'a small green sprout with two leaves growing from a seed',
    'quest': 'a rolled parchment quest scroll tied with a red ribbon',
    'done': 'a green leaf with a check mark shape',
    'locked': 'a small dark iron padlock',
    'reroll': 'two wooden dice',
    'harvest': 'a bundle of golden wheat',
    'boxes': 'a small wooden crate with a gold band',
    'grovePacks': 'a small round oak tree',
    'stall': 'a little market stall with a striped awning',
    'sweetTooth': 'a honey pot with a dipper',
    'comb': 'a piece of hexagonal honeycomb',
    'warmBrood': 'a glowing orange sun',
    'extraComb': 'two stacked honeycomb pieces',
    'twinEggs': 'two small pale insect eggs',
    'royalJelly': 'a small golden crown on a drop of jelly',
    'luckyRip': 'a four-leaf clover',
    'sweetNectar': 'a pink flower',
    'goldenHour': 'a bright golden star',
    'gilded': 'a pair of shiny gold insect wings',
    'prismatic': 'a rainbow colored beetle shell',
    'kinship': 'two small ants holding hands, friendship',
    'keen': 'a pair of sharp insect mandibles',
    'bounce': 'a thick orange curved arrow that bends back, ricochet symbol',
    'markedPrey': 'a red target mark on a skull',
    'commonKin': 'a small red ant head',
    'webLore': 'a spider web',
    'emberLore': 'a small flame',
    'swarmLore': 'a bee',
    'stinger': 'a sharp golden stinger dagger',
    'quickSting': 'a yellow lightning bolt',
    'wideSting': 'a ring shockwave circle',
    'husk': 'a brown beetle shell shield',
    'sapFlow': 'a green drop of tree sap',
    'regrowth': 'a sprouting green seedling',
    'chant': 'a musical note made of leaves',
    'silkstorm': 'a swirl of white spider silk',
    'embers': 'falling glowing embers and fire',
    'rally': 'a curling pheromone scent trail, golden swirl',
}
ICON_STYLE = 'single game item icon, pixel art, centered, bold 1px dark outline, no text'


def generate(name, seed=None):
    w, h, desc = PIECES[name]
    body = {'description': f'{desc}. {STYLE}', 'image_size': {'width': w, 'height': h}, 'no_background': True,
            'target_palette': {'colors': HEARTSEED, 'name': 'Heartseed'}}
    if seed is not None: body['seed'] = seed
    job = call('POST', '/generate-ui-v2', body)
    res = wait_job(job['background_job_id'])
    imgs = (res.get('last_response') or {}).get('images') or []
    for i, im in enumerate(imgs):
        unb64(im).save(CACHE / f'{name}.{i}.png')
    print(f'{name}: {len(imgs)} images')


def generate_icon(name):
    from PIL import Image
    pal = Image.new('RGB', (len(HEARTSEED), 1))
    pal.putdata([tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in HEARTSEED])
    from pixellab import b64img
    body = {'description': f'{ICONS[name]}, {ICON_STYLE}', 'image_size': {'width': 32, 'height': 32},
            'no_background': True, 'outline': 'single color black outline', 'shading': 'medium shading',
            'detail': 'medium detail', 'color_image': b64img(pal.convert('RGBA'))}
    unb64(call('POST', '/create-image-pixflux', body)['image']).save(CACHE / f'icon_{name}.0.png')
    print(f'icon {name}')


def main():
    names = [a for a in sys.argv[1:] if not a.startswith('--')] or list(PIECES) + [f'icon_{k}' for k in ICONS]
    CACHE.mkdir(parents=True, exist_ok=True)
    for n in names:
        if '--force' in sys.argv or not list(CACHE.glob(f'{n}.*.png')):
            for old in CACHE.glob(f'{n}.*.png'): old.unlink()
            generate_icon(n[5:]) if n.startswith('icon_') else generate(n)


if __name__ == '__main__':
    main()
