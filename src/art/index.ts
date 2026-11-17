// Pixel-art sprites. The PNGs are 2-frame horizontal strips built by `npm run art`
// (scripts/art/sprites.mjs). To swap in PixelLab art later, replace a PNG with a strip of the
// same frame size, or change its frame size below.
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

/** Every sprite is drawn this many times bigger on screen. */
export const ART_SCALE = 2;

const SHEETS: Record<string, { url: string; w: number; h: number; fps?: number }> = {
  ant: { url: ant, w: 20, h: 20 },
  orbweaver: { url: orbweaver, w: 20, h: 20 },
  firefly: { url: firefly, w: 20, h: 20, fps: 10 },
  bee: { url: bee, w: 20, h: 20, fps: 12 },
  bombardier: { url: bombardier, w: 20, h: 20 },
  trapdoor: { url: trapdoor, w: 20, h: 20 },
  stag: { url: stag, w: 24, h: 22 },
  mantis: { url: mantis, w: 20, h: 24 },
  grub: { url: grub, w: 16, h: 12, fps: 4 },
  wasp: { url: wasp, w: 18, h: 16, fps: 12 },
  snail: { url: snail, w: 22, h: 18, fps: 3 },
  wisp: { url: wisp, w: 16, h: 18, fps: 6 },
  toad: { url: toad, w: 32, h: 26, fps: 3 },
  frogking: { url: frogking, w: 48, h: 44, fps: 2 },
  heartseed: { url: heartseed, w: 36, h: 36, fps: 2 },
  pack_meadow: { url: packMeadow, w: 24, h: 32, fps: 3 },
  pack_grove: { url: packGrove, w: 24, h: 32, fps: 3 },
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
