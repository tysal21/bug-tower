import Phaser from 'phaser';
import { ENEMIES, HEROES, HERO_IDS, TUNING, WAVES, DamageType, TAG_COLOR } from '../game/data';
import { Enemy } from '../game/Enemy';
import { Hero } from '../game/Hero';

export const W = 1280;
export const H = 720;
const SEED = { x: 640, y: 470, r: 46 };
const GROUND_Y = 520;
// Three slots on each side of the seed, listed inner to outer, alternating left and right.
const SLOTS = [
  { x: 560, y: 400 }, { x: 720, y: 400 },
  { x: 470, y: 440 }, { x: 810, y: 440 },
  { x: 380, y: 400 }, { x: 900, y: 400 },
];

interface Spawn { at: number; enemy: string; side: 'left' | 'right' | 'air' }

export class BattleScene extends Phaser.Scene {
  enemies: Enemy[] = [];
  heroes: (Hero | null)[] = [];
  slotFrames: Phaser.GameObjects.Rectangle[] = [];
  seedHp = TUNING.seedHp;
  nectar = 0;
  waveIndex = -1;
  waveTime = 0;
  schedule: Spawn[] = [];
  breakTimer = 0;
  state: 'playing' | 'won' | 'lost' = 'playing';
  time_ = 0;
  speed = 1;
  stats = { kills: 0, wildfires: 0, executes: 0, stingerHits: 0 };

  // Stinger (click attack)
  stingerDown = false;
  stingerCooldown = 0;
  reticle!: Phaser.GameObjects.Arc;

  seedBody!: Phaser.GameObjects.Arc;
  hud!: Phaser.GameObjects.Text;
  seedBar!: Phaser.GameObjects.Graphics;
  banner!: Phaser.GameObjects.Text;

  constructor() { super('battle'); }

  create() {
    // Reset state (scene.restart re-runs create on the same object).
    this.enemies = []; this.heroes = []; this.slotFrames = [];
    this.seedHp = TUNING.seedHp; this.nectar = 0; this.waveIndex = -1; this.waveTime = 0;
    this.schedule = []; this.breakTimer = 2; this.state = 'playing'; this.time_ = 0;
    this.stats = { kills: 0, wildfires: 0, executes: 0, stingerHits: 0 };
    this.speed = Number(new URLSearchParams(location.search).get('speed')) || 1;

    // Ground and seed
    this.add.rectangle(W / 2, GROUND_Y + 110, W, 220, 0x2a2318);
    this.add.rectangle(W / 2, GROUND_Y + 2, W, 4, 0x4a3d28);
    this.seedBody = this.add.circle(SEED.x, SEED.y, SEED.r, 0x9be36d).setStrokeStyle(4, 0x3f6e2a);
    this.add.text(SEED.x, SEED.y, 'SEED', { fontFamily: 'monospace', fontSize: '14px', color: '#1d3311' }).setOrigin(0.5);

    // Hero slots (greybox test mode: click a slot to cycle through heroes)
    SLOTS.forEach((s, i) => {
      const frame = this.add.rectangle(s.x, s.y, 46, 46).setStrokeStyle(2, 0x5a4d38).setFillStyle(0x000000, 0.25);
      this.slotFrames.push(frame);
      this.heroes.push(null);
      const start = TUNING.startingHeroes[i];
      if (start) this.placeHero(i, start);
    });

    this.seedBar = this.add.graphics();
    this.hud = this.add.text(16, 12, '', { fontFamily: 'monospace', fontSize: '16px', color: '#f0e6d2' });
    this.add.text(W - 16, 12, 'TEST MODE: click a square slot to swap heroes\nHold the mouse on enemies to Sting them', {
      fontFamily: 'monospace', fontSize: '13px', color: '#a89a80', align: 'right',
    }).setOrigin(1, 0);
    this.banner = this.add.text(W / 2, 200, '', { fontFamily: 'monospace', fontSize: '40px', color: '#ffffff', align: 'center' })
      .setOrigin(0.5).setDepth(10);
    this.reticle = this.add.circle(0, 0, TUNING.stinger.hitRadius).setStrokeStyle(2, 0xff4d6d, 0.8).setVisible(false).setDepth(5);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.state !== 'playing') { this.scene.restart(); return; }
      const slot = SLOTS.findIndex(s => Math.abs(p.worldX - s.x) < 26 && Math.abs(p.worldY - s.y) < 26);
      if (slot >= 0) { this.cycleSlot(slot); return; }
      this.stingerDown = true;
    });
    this.input.on('pointerup', () => { this.stingerDown = false; });
    this.input.on('pointerupoutside', () => { this.stingerDown = false; });

    (window as unknown as { __battle: BattleScene }).__battle = this;
  }

  // ---------- heroes ----------
  placeHero(slot: number, id: string) {
    this.heroes[slot]?.destroy();
    const s = SLOTS[slot];
    this.heroes[slot] = id ? new Hero(this, id, HEROES[id], s.x, s.y) : null;
  }

  cycleSlot(slot: number) {
    const cur = this.heroes[slot]?.id;
    const order = ['', ...HERO_IDS];
    const next = order[(order.indexOf(cur ?? '') + 1) % order.length];
    this.placeHero(slot, next);
    if (next) this.floatText(SLOTS[slot].x, SLOTS[slot].y - 36, HEROES[next].name, '#ffffff');
  }

  swarmCount() { return this.heroes.filter(h => h?.def.tag === 'swarm').length; }

  updateHeroes(dt: number) {
    const swarm = this.swarmCount();
    for (const h of this.heroes) {
      if (!h) continue;
      h.cooldown -= dt;
      if (h.cooldown > 0) continue;
      const target = this.pickTarget(h);
      if (!target) continue;
      let aps = h.def.attacksPerSec;
      if (h.def.tag === 'swarm') aps *= 1 + TUNING.swarmSpeedPerAlly * (swarm - 1);
      h.cooldown = 1 / aps;
      this.shoot(h, target);
    }
  }

  /** Targets the enemy in range that is closest to the seed. */
  pickTarget(h: Hero): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || (e.def.flying && !h.def.hitsAir)) continue;
      if (Math.hypot(e.x - h.x, e.y - h.y) > h.def.range) continue;
      const d = Math.hypot(e.x - SEED.x, e.y - SEED.y);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  shoot(h: Hero, target: Enemy) {
    const color = h.def.damageType === 'fire' ? 0xff8a2a : TAG_COLOR[h.def.tag];
    const bolt = this.add.circle(h.x, h.y, h.def.splash ? 7 : 4, color).setDepth(4);
    this.tweens.add({
      targets: bolt, x: target.x, y: target.y, duration: 140 / this.speed,
      onComplete: () => {
        bolt.destroy();
        const hit = h.def.splash
          ? this.enemies.filter(e => e.alive && (h.def.hitsAir || !e.def.flying) && Math.hypot(e.x - target.x, e.y - target.y) <= h.def.splash!)
          : target.alive ? [target] : [];
        if (h.def.splash) this.ring(target.x, target.y, h.def.splash, color);
        for (const e of hit) this.applyHit(h, e);
      },
    });
  }

  applyHit(h: Hero, e: Enemy) {
    const d = h.def;
    let dmg = d.damage;
    if (d.tag === 'swarm' && e.webbed) dmg *= 1 + TUNING.feastBonus; // Feast
    // Wildfire: fire hitting a webbed enemy ignites the web.
    if (d.damageType === 'fire' && e.webbed) this.wildfire(e);
    this.damage(e, dmg, d.damageType);
    if (!e.alive) return;
    if (d.webSec) e.webUntil = this.time_ + d.webSec;
    if (d.burnSec) { e.burnUntil = this.time_ + d.burnSec; e.burnDps = Math.max(d.burnDps ?? 0, e.burning ? e.burnDps : 0); }
    if (d.sunderSec) e.sunderUntil = this.time_ + d.sunderSec;
    if (d.executeBelow && (e.webbed || e.burning) && e.hp / e.def.hp < d.executeBelow) {
      this.stats.executes++;
      this.floatText(e.x, e.y - 30, 'EXECUTE', '#f5b301');
      this.kill(e);
    }
  }

  wildfire(origin: Enemy) {
    const wf = TUNING.wildfire;
    this.stats.wildfires++;
    origin.webUntil = 0;
    this.ring(origin.x, origin.y, wf.radius, 0xff5a1f);
    this.floatText(origin.x, origin.y - 34, 'WILDFIRE!', '#ff8a2a');
    for (const e of this.enemies) {
      if (!e.alive || Math.hypot(e.x - origin.x, e.y - origin.y) > wf.radius) continue;
      this.damage(e, wf.burst, 'fire');
      if (e.alive) { e.burnUntil = this.time_ + wf.burnSec; e.burnDps = Math.max(e.burnDps, wf.burnDps); }
    }
  }

  // ---------- damage ----------
  damage(e: Enemy, amount: number, type: DamageType, showNumber = true) {
    if (!e.alive) return;
    if (type === 'physical') {
      if (e.def.physicalImmune) { if (showNumber) this.floatText(e.x, e.y - 20, 'IMMUNE', '#b07cff'); return; }
      const armor = e.sundered ? e.def.armor * (1 - TUNING.sunderArmorCut) : e.def.armor;
      amount *= 1 - armor;
    }
    e.hp -= amount;
    if (showNumber) this.floatText(e.x + Phaser.Math.Between(-8, 8), e.y - 20, String(Math.round(amount)), type === 'fire' ? '#ffb070' : '#ffffff');
    if (e.hp <= 0) this.kill(e);
  }

  kill(e: Enemy) {
    if (!e.alive) return;
    this.nectar += e.def.nectar;
    this.stats.kills++;
    this.floatText(e.x, e.y, `+${e.def.nectar}`, '#f2c94c');
    e.destroy();
  }

  // ---------- stinger ----------
  updateStinger(dt: number) {
    const p = this.input.activePointer;
    this.reticle.setPosition(p.worldX, p.worldY).setVisible(this.stingerDown);
    this.stingerCooldown -= dt;
    if (!this.stingerDown || this.stingerCooldown > 0) return;
    const st = TUNING.stinger;
    let best: Enemy | null = null;
    let bestD = st.hitRadius;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.worldX, e.y - p.worldY);
      if (e.alive && d <= bestD) { bestD = d; best = e; }
    }
    if (!best) return;
    this.stingerCooldown = 1 / st.attacksPerSec;
    this.stats.stingerHits++;
    this.damage(best, st.damage * (best.webbed ? 1 + st.webbedBonus : 1), 'physical');
    this.ring(best.x, best.y, 16, 0xff4d6d);
  }

  // ---------- waves ----------
  startWave(i: number) {
    this.waveIndex = i;
    this.waveTime = 0;
    this.schedule = [];
    for (const g of WAVES[i].groups) {
      for (let n = 0; n < g.count; n++) {
        const side = g.side === 'both' ? (n % 2 ? 'right' : 'left') : g.side;
        this.schedule.push({ at: (g.delay ?? 0) + n * g.every, enemy: g.enemy, side });
      }
    }
    this.schedule.sort((a, b) => a.at - b.at);
    this.showBanner(`Wave ${i + 1}`);
  }

  spawn(s: Spawn) {
    const def = ENEMIES[s.enemy];
    let x: number, y: number;
    if (s.side === 'air') { x = Phaser.Math.Between(100, W - 100); y = -30; }
    else { x = s.side === 'left' ? -30 : W + 30; y = GROUND_Y - def.size + Phaser.Math.Between(-6, 6); }
    const ty = def.flying ? SEED.y - 20 : y;
    this.enemies.push(new Enemy(this, s.enemy, def, x, y, SEED.x, ty));
  }

  updateWaves(dt: number) {
    if (this.waveIndex >= 0) {
      this.waveTime += dt;
      while (this.schedule.length && this.schedule[0].at <= this.waveTime) this.spawn(this.schedule.shift()!);
    }
    const waveDone = this.schedule.length === 0 && !this.enemies.some(e => e.alive);
    if (!waveDone) return;
    if (this.waveIndex === WAVES.length - 1) { this.end('won'); return; }
    this.breakTimer -= dt;
    if (this.breakTimer <= 0) { this.breakTimer = TUNING.secondsBetweenWaves; this.startWave(this.waveIndex + 1); }
  }

  end(result: 'won' | 'lost') {
    this.state = result;
    this.stingerDown = false;
    const s = this.stats;
    this.banner.setText(
      (result === 'won' ? 'The Heartseed survives!' : 'The Heartseed has fallen') +
      `\n\nWave ${this.waveIndex + 1} · ${s.kills} kills · ${this.nectar} Nectar\n${s.wildfires} Wildfires · ${s.executes} executes · ${s.stingerHits} stings\n\nClick to play again`,
    ).setFontSize(26).setAlpha(1);
  }

  // ---------- main loop ----------
  update(_t: number, deltaMs: number) {
    if (this.state !== 'playing') return;
    const dt = Math.min(deltaMs / 1000, 0.05) * this.speed;
    this.time_ += dt;

    this.updateWaves(dt);
    this.updateStinger(dt);
    this.updateHeroes(dt);

    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.update(dt, this.time_);
      if (e.burning) this.damage(e, e.burnDps * dt, 'fire', false);
      if (e.alive && e.atSeed) this.seedHp -= e.def.seedDps * dt;
    }
    this.enemies = this.enemies.filter(e => e.alive);

    if (this.seedHp <= 0) { this.seedHp = 0; this.end('lost'); }
    this.seedBody.setFillStyle(this.enemies.some(e => e.atSeed) && Math.sin(this.time_ * 20) > 0 ? 0xd9f0c8 : 0x9be36d);
    this.drawHud();
  }

  drawHud() {
    const wave = Math.max(this.waveIndex + 1, 1);
    this.hud.setText(`Wave ${wave}/${WAVES.length}   Nectar ${this.nectar}   Enemies ${this.enemies.length + this.schedule.length}`);
    const bw = 400, x = W / 2 - bw / 2, y = 44;
    this.seedBar.clear();
    this.seedBar.fillStyle(0x000000, 0.6).fillRect(x, y, bw, 14);
    this.seedBar.fillStyle(0x9be36d).fillRect(x, y, (bw * this.seedHp) / TUNING.seedHp, 14);
    this.seedBar.lineStyle(1, 0xf0e6d2, 0.5).strokeRect(x, y, bw, 14);
  }

  // ---------- little effects ----------
  floatText(x: number, y: number, text: string, color: string) {
    const t = this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: '14px', color, stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  ring(x: number, y: number, r: number, color: number) {
    const c = this.add.circle(x, y, r).setStrokeStyle(3, color, 0.9).setDepth(4);
    this.tweens.add({ targets: c, alpha: 0, scale: 1.15, duration: 300, onComplete: () => c.destroy() });
  }

  showBanner(text: string) {
    this.banner.setText(text).setFontSize(40).setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 900, duration: 500 });
  }
}
