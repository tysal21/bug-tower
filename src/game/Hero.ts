import Phaser from 'phaser';
import { HeroDef, TAG_COLOR, TUNING } from './data';
import type { Variant } from '../meta/save';
import { addArt, hasArt } from '../art';

export class Hero {
  cooldown = 0;
  homeX: number;
  homeY: number;
  copies = 1;
  stunnedUntil = 0;
  trapTimer = 0;
  stars = 1;
  variant: Variant = 'standard';
  body: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  /** Ground shadow, rimmed in the rarity colour. */
  ring: Phaser.GameObjects.Ellipse;
  label?: Phaser.GameObjects.Text;
  starText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, public id: string, public def: HeroDef, public x: number, public y: number) {
    this.homeX = x; this.homeY = y;
    this.ring = scene.add.ellipse(x, y + 16, 30, 10, 0x000000, 0.35).setStrokeStyle(2, rarityColor(def.rarity), 0.9).setDepth(1.5);
    if (hasArt(id)) {
      this.body = addArt(scene, id, x, y).setDepth(2);
    } else {
      // Greybox fallback for helpers that have no sprite yet.
      this.body = scene.add.rectangle(x, y, 30, 30, TAG_COLOR[def.tag]).setStrokeStyle(3, rarityColor(def.rarity)).setDepth(2);
      this.label = scene.add
        .text(x, y, def.name.split(/[ -]/)[0].slice(0, 4), { fontFamily: 'monospace', fontSize: '11px', color: '#111' })
        .setOrigin(0.5).setDepth(2);
    }
    this.starText = scene.add
      .text(x, y + 26, '', { fontFamily: 'monospace', fontSize: '13px', color: '#f5d76e', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(2);
    this.refresh();
  }

  /** Damage after star bonus. */
  get damage() { return this.def.damage * Math.pow(TUNING.starMultiplier, this.stars - 1); }

  /** Moves the hero toward a point. Returns true once it has arrived. */
  moveToward(tx: number, ty: number, dt: number, stopAt = 0): boolean {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= stopAt + 1) return true;
    const step = Math.min(d - stopAt, (this.def.moveSpeed ?? 0) * dt);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    this.body.setPosition(this.x, this.y);
    if (this.body instanceof Phaser.GameObjects.Sprite && Math.abs(dx) > 2) this.body.setFlipX(dx < 0);
    this.ring.setPosition(this.x, this.y + 16);
    this.label?.setPosition(this.x, this.y);
    this.starText.setPosition(this.x, this.y + 26);
    return false;
  }

  /** Moves the hero home position (used when it is placed or replaced). */
  setHome(x: number, y: number) { this.homeX = x; this.homeY = y; }

  refresh() {
    this.starText.setText('★'.repeat(this.stars) + (this.variant === 'holo' ? ' ◈' : this.variant === 'foil' ? ' ✦' : ''));
  }

  destroy() {
    this.body.destroy();
    this.ring.destroy();
    this.label?.destroy();
    this.starText.destroy();
  }
}

export function rarityColor(r: HeroDef['rarity']): number {
  return { common: 0x666666, rare: 0x3b82f6, epic: 0xa855f7, legendary: 0xf5b301 }[r];
}
