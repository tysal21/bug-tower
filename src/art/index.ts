// Pixel-art sprites made with PixelLab. The PNGs are 2-frame horizontal strips built by
// scripts/art/pixellab.py (raw outputs cached in scripts/art/pixellab/). The older hand-drawn
// placeholders can still be rebuilt with `npm run art` (scripts/art/sprites.mjs), but their
// frames are half this size, so set ART_SCALE back to 2 and restore the old frame sizes if you do.
import Phaser from 'phaser';
import ant from './ant.png';
import orbweaver from './orbweaver.png';
import firefly from './firefly.png';
import bee from './bee.png';
import bombardier from './bombardier.png';
import trapdoor from './trapdoor.png';
import stag from './stag.png';
import mantis from './mantis.png';
import grub from './grub.png';
import wasp from './wasp.png';
import snail from './snail.png';
import wisp from './wisp.png';
import toad from './toad.png';
import frogking from './frogking.png';
import heartseed from './heartseed.png';
import packMeadow from './pack_meadow.png';
import packGrove from './pack_grove.png';

/** Every sprite is drawn this many times bigger on screen. PixelLab art is drawn at its on-screen size. */
export const ART_SCALE = 1;

const SHEETS: Record<string, { url: string; w: number; h: number; fps?: number }> = {
  ant: { url: ant, w: 40, h: 40 },
  orbweaver: { url: orbweaver, w: 40, h: 40 },
  firefly: { url: firefly, w: 40, h: 40, fps: 10 },
  bee: { url: bee, w: 40, h: 40, fps: 12 },
  bombardier: { url: bombardier, w: 40, h: 40 },
  trapdoor: { url: trapdoor, w: 40, h: 40 },
  stag: { url: stag, w: 48, h: 44 },
  mantis: { url: mantis, w: 40, h: 48 },
  grub: { url: grub, w: 32, h: 32, fps: 4 },
  wasp: { url: wasp, w: 36, h: 32, fps: 12 },
  snail: { url: snail, w: 44, h: 36, fps: 3 },
  wisp: { url: wisp, w: 32, h: 36, fps: 6 },
  toad: { url: toad, w: 64, h: 52, fps: 3 },
  frogking: { url: frogking, w: 96, h: 88, fps: 2 },
  heartseed: { url: heartseed, w: 72, h: 72, fps: 2 },
  pack_meadow: { url: packMeadow, w: 48, h: 64, fps: 3 },
  pack_grove: { url: packGrove, w: 48, h: 64, fps: 3 },
};

export const PACK_ART = { meadow: packMeadow, grove: packGrove };

/** Call from a scene's preload(). */
export function loadArt(scene: Phaser.Scene) {
  for (const [key, s] of Object.entries(SHEETS)) {
    if (!scene.textures.exists(key)) scene.load.spritesheet(key, s.url, { frameWidth: s.w, frameHeight: s.h });
  }
}

/** Call from create(): crisp pixels and a looping 2-frame animation per sprite ("<key>-idle"). */
export function makeAnims(scene: Phaser.Scene) {
  for (const [key, s] of Object.entries(SHEETS)) {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (!scene.anims.exists(`${key}-idle`)) {
      scene.anims.create({ key: `${key}-idle`, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 1 }), frameRate: s.fps ?? 6, repeat: -1 });
    }
  }
}

export function hasArt(key: string) { return key in SHEETS; }

/** A looping animated sprite at ART_SCALE, randomly offset so a crowd doesn't step in sync. */
export function addArt(scene: Phaser.Scene, key: string, x: number, y: number) {
  const spr = scene.add.sprite(x, y, key, 0).setScale(ART_SCALE);
  spr.play({ key: `${key}-idle`, startFrame: Math.random() < 0.5 ? 0 : 1 });
  return spr;
}
