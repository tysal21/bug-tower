import Phaser from 'phaser';
import { HeroDef, TAG_COLOR, TUNING } from './data';

export class Hero {
  cooldown = 0;
  homeX: number;
  homeY: number;
  copies = 1;
  stunnedUntil = 0;
  trapTimer = 0;
  stars = 1;
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  starText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, public id: string, public def: HeroDef, public x: number, public y: number) {
    this.homeX = x; this.homeY = y;
    const size = 30;
    this.body = scene.add.rectangle(x, y, size, size, TAG_COLOR[def.tag]).setStrokeStyle(3, rarityColor(def.rarity)).setDepth(2);
    this.label = scene.add
      .text(x, y, def.name.split(/[ -]/)[0].slice(0, 4), { fontFamily: 'monospace', fontSize: '11px', color: '#111' })
      .setOrigin(0.5).setDepth(2);
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
    this.label.setPosition(this.x, this.y);
    this.starText.setPosition(this.x, this.y + 26);
    return false;
  }

  /** Moves the hero home position (used when it is placed or replaced). */
  setHome(x: number, y: number) { this.homeX = x; this.homeY = y; }

  refresh() { this.starText.setText('★'.repeat(this.stars)); }

  destroy() {
    this.body.destroy();
    this.label.destroy();
    this.starText.destroy();
  }
}

export function rarityColor(r: HeroDef['rarity']): number {
  return { common: 0x666666, rare: 0x3b82f6, epic: 0xa855f7, legendary: 0xf5b301 }[r];
}
