import Phaser from 'phaser';
import { EnemyDef, TUNING } from './data';

/** An enemy that wanders toward the seed, pushing apart from its neighbours. */
export class Enemy {
  /** Extra web slow from the skill tree (set by the battle scene). */
  static webSlowBonus = 0;
  hp: number;
  maxHp: number;
  alive = true;
  atSeed = false;
  webUntil = 0;
  burnUntil = 0;
  burnDps = 0;
  sunderUntil = 0;
  heldUntil = 0; // pinned in place by a melee helper
  speedMult = 1;
  now = 0;
  body: Phaser.GameObjects.Shape;
  shadow?: Phaser.GameObjects.Ellipse;
  ring: Phaser.GameObjects.Arc;
  bar: Phaser.GameObjects.Graphics;
  private wobblePhase = Math.random() * Math.PI * 2;
  private wobbleSpeed = 0.8 + Math.random() * 1.2;
  private wobbleAmount = 0.35 + Math.random() * 0.45; // radians of sideways drift

  constructor(
    scene: Phaser.Scene,
    public id: string,
    public def: EnemyDef,
    public x: number,
    public y: number,
    private seedX: number,
    private seedY: number,
    private seedR: number,
    hpScale = 1,
  ) {
    this.maxHp = def.hp * hpScale;
    this.hp = this.maxHp;
    const s = def.size;
    if (def.boss) {
      this.body = scene.add.circle(x, y, s, 0x3f7a3a).setStrokeStyle(6, 0xd4af37).setDepth(3);
    } else if (def.flying) {
      this.shadow = scene.add.ellipse(x, y + 14, s * 1.6, s * 0.6, 0x000000, 0.35);
      this.body = scene.add.triangle(x, y, 0, s * 2, s, 0, s * 2, s * 2, 0xf2d04c).setStrokeStyle(2, 0x3a2a00).setDepth(3);
    } else if (def.physicalImmune) {
      this.body = scene.add.circle(x, y, s, 0xb07cff, 0.55).setStrokeStyle(2, 0xe0ccff);
    } else if (def.armor > 0) {
      this.body = scene.add.circle(x, y, s, 0x7d8590).setStrokeStyle(5, 0xc8ced6);
    } else {
      this.body = scene.add.circle(x, y, s, 0x6fae4a).setStrokeStyle(2, 0x2e4a1f);
    }
    this.ring = scene.add.circle(x, y, s + 6).setStrokeStyle(2, 0xffffff, 0.9).setVisible(false).setDepth(3);
    this.bar = scene.add.graphics().setDepth(6);
  }

  get webbed() { return this.webUntil > this.now; }
  get burning() { return this.burnUntil > this.now; }
  get sundered() { return this.sunderUntil > this.now; }
  get stopDist() { return this.seedR + this.def.size + (this.def.flying ? 10 : 2); }

  update(dt: number, now: number, others: Enemy[]) {
    this.now = now;
    if (!this.alive) return;
    const dx = this.seedX - this.x;
    const dy = this.seedY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.stopDist + 1 && this.heldUntil <= now) {
      // Head for the seed, drifting side to side so they don't march in straight lines.
      const angle = Math.atan2(dy, dx) + Math.sin(now * this.wobbleSpeed + this.wobblePhase) * this.wobbleAmount * Math.min(1, dist / 250);
      const slow = this.webbed ? 1 - Math.min(0.8, TUNING.webSlow + Enemy.webSlowBonus) : 1;
      let vx = Math.cos(angle) * this.def.speed * slow * this.speedMult;
      let vy = Math.sin(angle) * this.def.speed * slow * this.speedMult;
      // Separation: push away from neighbours of the same layer (ground or air).
      for (const o of others) {
        if (o === this || !o.alive || o.def.flying !== this.def.flying) continue;
        const ox = this.x - o.x, oy = this.y - o.y;
        const d = Math.hypot(ox, oy);
        const minD = this.def.size + o.def.size + 4;
        if (d > 0 && d < minD) { vx += (ox / d) * 60 * (1 - d / minD) * 3; vy += (oy / d) * 60 * (1 - d / minD) * 3; }
      }
      this.x += vx * dt;
      this.y += vy * dt;
    }
    // Never overlap the seed.
    const nd = Math.hypot(this.x - this.seedX, this.y - this.seedY);
    if (nd < this.stopDist) {
      this.x = this.seedX + ((this.x - this.seedX) / nd) * this.stopDist;
      this.y = this.seedY + ((this.y - this.seedY) / nd) * this.stopDist;
    }
    this.atSeed = nd <= this.stopDist + 3;
    this.draw();
  }

  draw() {
    this.body.setPosition(this.x, this.y);
    this.shadow?.setPosition(this.x, this.y + 16);
    this.ring.setPosition(this.x, this.y).setVisible(this.webbed);
    if (this.burning) this.body.setAlpha(0.6 + 0.4 * Math.abs(Math.sin(this.now * 12)));
    else this.body.setAlpha(this.def.physicalImmune ? 0.55 : 1);
    const w = this.def.size * 2.4;
    this.bar.clear();
    if (this.hp < this.maxHp && !this.def.boss) {
      this.bar.fillStyle(0x000000, 0.6).fillRect(this.x - w / 2, this.y - this.def.size - 12, w, 4);
      this.bar.fillStyle(this.burning ? 0xff8a2a : 0xe5484d).fillRect(this.x - w / 2, this.y - this.def.size - 12, (w * Math.max(0, this.hp)) / this.maxHp, 4);
    }
  }

  destroy() {
    this.alive = false;
    this.body.destroy();
    this.shadow?.destroy();
    this.ring.destroy();
    this.bar.destroy();
  }
}
