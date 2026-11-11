import Phaser from 'phaser';
import { EnemyDef, TUNING } from './data';

export class Enemy {
  hp: number;
  alive = true;
  atSeed = false;
  webUntil = 0;
  burnUntil = 0;
  burnDps = 0;
  sunderUntil = 0;
  body: Phaser.GameObjects.Shape;
  ring: Phaser.GameObjects.Arc;
  bar: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    public id: string,
    public def: EnemyDef,
    public x: number,
    public y: number,
    private targetX: number,
    private targetY: number,
  ) {
    this.hp = def.hp;
    const s = def.size;
    if (def.flying) {
      this.body = scene.add.triangle(x, y, 0, s * 2, s, 0, s * 2, s * 2, 0xf2d04c).setStrokeStyle(2, 0x3a2a00);
    } else if (def.physicalImmune) {
      this.body = scene.add.circle(x, y, s, 0xb07cff, 0.55).setStrokeStyle(2, 0xe0ccff);
    } else if (def.armor > 0) {
      this.body = scene.add.circle(x, y, s, 0x7d8590).setStrokeStyle(5, 0xc8ced6);
    } else {
      this.body = scene.add.circle(x, y, s, 0x6fae4a).setStrokeStyle(2, 0x2e4a1f);
    }
    this.ring = scene.add.circle(x, y, s + 6).setStrokeStyle(2, 0xffffff, 0.9).setFillStyle().setVisible(false);
    this.bar = scene.add.graphics();
  }

  get webbed() { return this.webUntil > this.now; }
  get burning() { return this.burnUntil > this.now; }
  get sundered() { return this.sunderUntil > this.now; }
  now = 0;

  /** Moves toward the seed. Returns true when it is touching the seed. */
  update(dt: number, now: number) {
    this.now = now;
    if (!this.alive) return;
    const slow = this.webbed ? 1 - TUNING.webSlow : 1;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    const stopAt = this.def.flying ? 75 : 62;
    if (dist > stopAt) {
      const step = Math.min(dist - stopAt, this.def.speed * slow * dt);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.atSeed = false;
    } else {
      this.atSeed = true;
    }
    this.draw();
  }

  draw() {
    this.body.setPosition(this.x, this.y);
    this.ring.setPosition(this.x, this.y).setVisible(this.webbed);
    // Burning: flicker orange.
    if (this.burning) this.body.setAlpha(0.6 + 0.4 * Math.abs(Math.sin(this.now * 12)));
    else this.body.setAlpha(this.def.physicalImmune ? 0.55 : 1);
    const w = this.def.size * 2.4;
    this.bar.clear();
    if (this.hp < this.def.hp) {
      this.bar.fillStyle(0x000000, 0.6).fillRect(this.x - w / 2, this.y - this.def.size - 12, w, 4);
      this.bar.fillStyle(this.burning ? 0xff8a2a : 0xe5484d).fillRect(this.x - w / 2, this.y - this.def.size - 12, (w * this.hp) / this.def.hp, 4);
    }
  }

  destroy() {
    this.alive = false;
    this.body.destroy();
    this.ring.destroy();
    this.bar.destroy();
  }
}
