#!/usr/bin/env python3
"""Generate the game's sprites with PixelLab (https://api.pixellab.ai/v2).

Each sprite is a 2-frame horizontal strip in src/art/<name>.png, the same layout the
hand-drawn placeholders use, so the game picks them up with no code change beyond the
frame sizes in src/art/index.ts.

Step 1: frame 1 comes from /create-image-pixflux (side view, facing right, transparent).
Step 2: /animate-with-text-v3 animates that frame; we keep one mid-cycle frame as frame 2.

Raw PixelLab outputs are cached in scripts/art/pixellab/ so re-running only spends
generations on sprites whose cache is missing (delete a file, or pass its name, to redo it).

Usage:
  PIXELLAB_API_KEY=... python3 scripts/art/pixellab.py            # everything not cached
  python3 scripts/art/pixellab.py ant toad --force                 # redo some sprites
  python3 scripts/art/pixellab.py --strips-only                    # rebuild PNGs from cache
Needs Pillow (pip install pillow).
"""
import base64, io, json, os, ssl, sys, time, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'scripts/art/pixellab'
OUT = ROOT / 'src/art'
API = 'https://api.pixellab.ai/v2'

STYLE = ('cozy storybook fantasy pixel art game sprite, side view facing right, '
         'garden insect world, bold readable silhouette, warm earthy colors')

# name: (width, height, subject, animation action)
SPRITES = {
    # helpers (heroes)
    'ant': (40, 40, 'a small red ant soldier wearing a golden roman legionnaire helmet with a red crest, walking on six legs', 'walking, legs stepping'),
    'orbweaver': (40, 40, 'an orb-weaver spider with a round dark purple abdomen with gold markings, eight long legs', 'walking, legs stepping'),
    'firefly': (40, 40, 'a firefly beetle with a big glowing yellow-orange lantern abdomen, small wings, flying', 'hovering, wings flapping, lantern pulsing'),
    'bee': (40, 40, 'a honeybee knight holding a tiny lance, fuzzy yellow and black stripes, clear wings, flying', 'hovering, wings buzzing'),
    'bombardier': (40, 40, 'a bombardier beetle with a dark blue-black shell and orange legs and head, puff of hot smoke from its rear', 'walking, legs stepping'),
    'trapdoor': (40, 40, 'a stocky brown trapdoor spider, hairy thick legs, crouched', 'crouching, breathing, legs shifting'),
    'stag': (48, 44, 'a huge stag beetle titan, glossy dark brown armored beetle body with two giant curved pincer jaws at the front, insect not deer', 'walking, legs stepping'),
    'mantis': (40, 48, 'a noble green praying mantis saint with a small golden halo, raised scythe arms', 'standing, swaying, arms raised'),
    # enemies
    'grub': (32, 32, 'a fat segmented pale purple grub larva with green blight spots, chubby caterpillar body lying flat, head on the right', 'crawling, body squishing'),
    'wasp': (36, 32, 'an angry yellow and black wasp raider with a big stinger, flying', 'flying, wings buzzing'),
    'snail': (44, 36, 'an armored snail whose shell is grey riveted steel plates, greenish slimy body', 'crawling slowly'),
    'wisp': (32, 36, 'a floating ghostly wisp of dark purple blight smoke with glowing eyes', 'floating, flickering'),
    'toad': (64, 52, 'a big hulking warty brown and olive toad brute in side profile facing right, wide mouth, muscular front legs', 'breathing, throat puffing'),
    'frogking': (96, 88, 'a giant fat frog king boss wearing a golden crown and a red royal cape, sitting', 'breathing, throat puffing'),
    # base and packs
    'heartseed': (72, 72, 'a large magical glowing seed with a heart of golden light shining through cracks in its brown husk, a small sprout on top', 'glowing, pulsing gently'),
    'pack_meadow': (48, 64, 'a sealed foil trading card booster pack, green meadow theme, a little beetle emblem on a gold medallion, crimped top and bottom, front view', 'shiny sheen sweeping across'),
    'pack_grove': (48, 64, 'a sealed foil trading card booster pack, deep forest grove theme, purple and gold, a glowing leaf emblem, crimped top and bottom, front view', 'shiny sheen sweeping across'),
}
# Which animation frame becomes frame 2 (default: the middle one), and sprites PixelLab drew facing left.
PICK = {'frogking': 1}
FLIP = {'wasp', 'stag'}
FRONT = {'pack_meadow', 'pack_grove', 'heartseed', 'wisp'}


def _ctx():
    ca = os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None)
    return ssl.create_default_context(cafile=ca)


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + os.environ.get('PIXELLAB_API_KEY', 'proxy'),
                                          'Content-Type': 'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, context=_ctx(), timeout=180) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:400]
            if e.code in (429, 502, 503, 504) and attempt < 3:
                time.sleep(5 * (attempt + 1)); continue
            raise SystemExit(f'{method} {path} -> {e.code}: {msg}')


def b64img(img):
    buf = io.BytesIO(); img.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}


def unb64(d):
    s = d['base64'] if isinstance(d, dict) else d
    if s.startswith('data:'): s = s.split(',', 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(s))).convert('RGBA')


def wait_job(job_id):
    for _ in range(120):
        time.sleep(4)
        j = call('GET', f'/background-jobs/{job_id}')
        if j.get('status') == 'completed': return j
        if j.get('status') in ('failed', 'error', 'cancelled'): raise SystemExit(f'job {job_id}: {json.dumps(j)[:400]}')
    raise SystemExit(f'job {job_id} timed out')


def generate(name, seed=None):
    w, h, subject, action = SPRITES[name]
    body = {'description': f'{subject}, {STYLE}', 'image_size': {'width': w, 'height': h},
            'no_background': True, 'outline': 'single color black outline', 'shading': 'medium shading',
            'detail': 'medium detail', 'text_guidance_scale': 8}
    if name not in FRONT: body.update(view='side', direction='east')
    if seed is not None: body['seed'] = seed
    base = unb64(call('POST', '/create-image-pixflux', body)['image'])
    base.save(CACHE / f'{name}.0.png')
    # animate-v3 wants at least 32px a side; pad small sprites onto a centered canvas
    cw, ch = max(w, 32), max(h, 32)
    canvas = Image.new('RGBA', (cw, ch)); canvas.paste(base, ((cw - w) // 2, (ch - h) // 2))
    job = call('POST', '/animate-with-text-v3', {'first_frame': b64img(canvas), 'action': action,
                                                 'frame_count': 4, 'no_background': True})
    res = wait_job(job['background_job_id'])
    imgs = (res.get('last_response') or {}).get('images') or []
    for i, im in enumerate(imgs):
        unb64(im).save(CACHE / f'{name}.anim{i}.png')
    print(f'{name}: base + {len(imgs)} animation frames')


def strip(name):
    w, h = SPRITES[name][:2]
    f0 = Image.open(CACHE / f'{name}.0.png').convert('RGBA')
    anim = sorted(CACHE.glob(f'{name}.anim*.png'))
    f1 = Image.open(anim[PICK.get(name, len(anim) // 2)]).convert('RGBA') if anim else f0
    if f1.size != (w, h):  # undo the padding
        cw, ch = f1.size
        f1 = f1.crop(((cw - w) // 2, (ch - h) // 2, (cw - w) // 2 + w, (ch - h) // 2 + h))
    if name in FLIP:
        f0, f1 = (f.transpose(Image.FLIP_LEFT_RIGHT) for f in (f0, f1))
    out = Image.new('RGBA', (w * 2, h)); out.paste(f0, (0, 0)); out.paste(f1, (w, 0))
    out.save(OUT / f'{name}.png')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force, only_strips = '--force' in sys.argv, '--strips-only' in sys.argv
    CACHE.mkdir(parents=True, exist_ok=True)
    names = args or list(SPRITES)
    for n in names:
        if n not in SPRITES: raise SystemExit(f'unknown sprite {n}')
        if not only_strips and (force or not (CACHE / f'{n}.0.png').exists()):
            for old in CACHE.glob(f'{n}.*.png'): old.unlink()
            generate(n)
        strip(n)
    print(json.dumps(call('GET', '/balance')) if not only_strips else 'strips rebuilt')


if __name__ == '__main__':
    main()
