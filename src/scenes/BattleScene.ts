import Phaser from 'phaser';
import { ENEMIES, HEROES, HERO_IDS, TUNING, DamageType, TAG_COLOR } from '../game/data';
import { Enemy } from '../game/Enemy';
import { Hero } from '../game/Hero';
import { MetaStats } from '../meta/meta';

export const W = 1280;
export const H = 720;
const SEED = { x: 640, y: 360, r: 40 };
/** Where a helper idles when nothing is near: spread around the seed. */
function homeFor(i: number) {
  const a = -Math.PI / 2 + (i * Math.PI * 2) / TUNING.maxHelpers + 0.3;
  const r = 85 + (i % 2) * 35;
  return { x: SEED.x + Math.cos(a) * r, y: SEED.y + Math.sin(a) * r };
}

export interface TeamMember { id: string; copies: number; stars: number }
export interface RunResult { won: boolean; seconds: number; kills: number }
export interface RunSetup { team: TeamMember[]; meta: MetaStats; onEnd?: (r: RunResult) => void }

interface Trap { x: number; y: number; r: number; until: number; gfx: Phaser.GameObjects.Arc }

export class BattleScene extends Phaser.Scene {
  enemies: Enemy[] = [];
  heroes: (Hero | null)[] = [];
  seedHp = TUNING.seedHp;
  spawnDebt = 0; // fractional enemies owed by the spawn ramp
  nextSurge = 0;
  boss: Enemy | null = null;
  bossSpawned = false;
  bossTongue = 0;
  bossFlop = 0;
  traps: Trap[] = [];
  state: 'playing' | 'won' | 'lost' = 'playing';
  paused = false;
  time_ = 0;
  speed = 1;
  testMode = false;
  stats = { kills: 0, wildfires: 0, executes: 0, stingerHits: 0 };
  team: TeamMember[] = [];
  meta!: MetaStats;
  maxSeedHp = TUNING.seedHp;
  onEnd: (r: RunResult) => void = () => {};
  bossBar!: Phaser.GameObjects.Graphics;
  bossLabel!: Phaser.GameObjects.Text;

  stingerDown = false;
  uiPress = false; // true while a press that began on a button is held
  stingerCooldown = 0;
  reticle!: Phaser.GameObjects.Arc;
  seedBody!: Phaser.GameObjects.Arc;
  hud!: Phaser.GameObjects.Text;
  seedBar!: Phaser.GameObjects.Graphics;
  banner!: Phaser.GameObjects.Text;

  constructor() { super('battle'); }

  init(data: RunSetup) {
    this.team = data.team ?? [];
    this.meta = data.meta;
    this.onEnd = data.onEnd ?? (() => {});
  }

  create() {
    const q = new URLSearchParams(location.search);
    this.enemies = []; this.heroes = Array.from({ length: TUNING.maxHelpers }, () => null);
    this.maxSeedHp = TUNING.seedHp * this.meta.seedHpMult;
    this.seedHp = this.maxSeedHp;
    this.spawnDebt = 0; this.nextSurge = TUNING.run.surgeEverySec; this.boss = null; this.bossSpawned = false;
    this.bossTongue = 0; this.bossFlop = 0; this.traps = [];
    this.state = 'playing'; this.paused = false; this.time_ = 0;
    this.stats = { kills: 0, wildfires: 0, executes: 0, stingerHits: 0 };
    this.speed = Number(q.get('speed')) || 1;
    this.testMode = q.has('test');
    // ?boss skips ahead to 5 seconds before the Frog King, for testing.
    if (q.has('boss')) { this.time_ = TUNING.run.bossAtSec - 5; this.nextSurge = Infinity; }

    // Ground: a top-down meadow with a worn circle around the seed.
    this.add.rectangle(W / 2, H / 2, W, H, 0x23301c);
    this.add.circle(SEED.x, SEED.y, TUNING.heroLeash, 0x283522); // area helpers defend
    this.add.circle(SEED.x, SEED.y, 170, 0x2d3a22);
    this.seedBody = this.add.circle(SEED.x, SEED.y, SEED.r, 0x9be36d).setStrokeStyle(4, 0x3f6e2a).setDepth(1);
    this.add.text(SEED.x, SEED.y, 'SEED', { fontFamily: 'monospace', fontSize: '13px', color: '#1d3311' }).setOrigin(0.5).setDepth(1);

    this.seedBar = this.add.graphics().setDepth(9);
    this.bossBar = this.add.graphics().setDepth(9);
    this.bossLabel = this.add.text(W / 2, 40, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd76e' }).setOrigin(0.5, 0).setDepth(9);
    this.hud = this.add.text(16, 12, '', { fontFamily: 'monospace', fontSize: '16px', color: '#f0e6d2' }).setDepth(9);
    this.banner = this.add.text(W / 2, 150, '', { fontFamily: 'monospace', fontSize: '40px', color: '#ffffff', align: 'center', stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(15);
    this.reticle = this.add.circle(0, 0, TUNING.stinger.hitRadius).setStrokeStyle(2, 0xff4d6d, 0.8).setVisible(false).setDepth(8);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // Presses that start on a button or overlay never sting.
      this.uiPress = over.some(o => o.active && o.scene) || this.paused;
      if (this.uiPress) return;
      const slot = this.heroes.findIndex(h => h && Math.hypot(p.worldX - h.x, p.worldY - h.y) < 24);
      if (slot >= 0 && this.testMode) { this.cycleSlot(slot); return; }
    });
    this.input.on('pointerup', () => { this.uiPress = false; });
    this.input.on('pointerupoutside', () => { this.uiPress = false; });

    (window as unknown as { __battle: BattleScene }).__battle = this;
    // Bring in the team bought in the shop.
    this.team.forEach((m, i) => {
      if (i >= TUNING.maxHelpers) return;
      this.placeInSlot(i, m.id);
      const h = this.heroes[i]!;
      h.copies = m.copies; h.stars = m.stars; h.refresh();
    });
    this.drawHud();
    this.showBanner(this.team.length ? 'Defend the Heartseed!' : 'Hold on enemies to Sting them!');
  }

  placeInSlot(slot: number, id: string) {
    const old = this.heroes[slot];
    old?.destroy();
    const home = homeFor(slot);
    // New helpers pop out of the seed (or take the replaced helper's spot) and walk home.
    const sx = old ? old.x : SEED.x, sy = old ? old.y : SEED.y;
    const h = id ? new Hero(this, id, HEROES[id], sx, sy) : null;
    h?.setHome(home.x, home.y);
    this.heroes[slot] = h;
    if (id) this.floatText(sx, sy - 34, HEROES[id].name, '#ffffff');
  }

  cycleSlot(slot: number) {
    const order = ['', ...HERO_IDS];
    const next = order[(order.indexOf(this.heroes[slot]?.id ?? '') + 1) % order.length];
    this.placeInSlot(slot, next);
  }

  // ---------- heroes ----------
  updateHeroes(dt: number) {
    const swarm = this.heroes.filter(h => h?.def.tag === 'swarm').length;
    for (const h of this.heroes) {
      if (!h) continue;
      const stunned = h.stunnedUntil > this.time_;
      h.body.setAlpha(stunned ? 0.35 : 1);
      if (stunned) continue;
      h.cooldown -= dt;
      if (h.def.trapEverySec) {
        h.trapTimer -= dt;
        if (h.trapTimer <= 0 && this.enemies.some(e => e.alive && Math.hypot(e.x - h.x, e.y - h.y) < 250)) {
          h.trapTimer = h.def.trapEverySec;
          this.layTrap(h);
        }
      }
      const target = h.def.moves ? this.pickRoamTarget(h) : this.pickTarget(h);
      if (h.def.moves) {
        // Roamers chase enemies near the seed, then walk home when the area is clear.
        if (!target) { h.moveToward(h.homeX, h.homeY, dt); continue; }
        const inRange = h.moveToward(target.x, target.y, dt, h.def.range - 4);
        if (!inRange) continue;
        // Melee helpers pin their target in place while they fight it.
        if (h.def.range <= TUNING.meleeHoldRange && !target.def.boss) target.heldUntil = this.time_ + 0.25;
      }
      if (!target || h.cooldown > 0) continue;
      let aps = h.def.attacksPerSec;
      if (h.def.tag === 'swarm') aps *= 1 + TUNING.swarmSpeedPerAlly * (swarm - 1);
      h.cooldown = 1 / aps;
      this.shoot(h, target);
    }
  }

  layTrap(h: Hero) {
    const r = h.def.trapRadius ?? 60;
    const gfx = this.add.circle(h.x, h.y, r, 0xe8e8f0, 0.12).setStrokeStyle(2, 0xe8e8f0, 0.6).setDepth(0.5);
    this.traps.push({ x: h.x, y: h.y, r, until: this.time_ + (h.def.trapSec ?? 8), gfx });
  }

  updateTraps() {
    for (const t of this.traps) {
      for (const e of this.enemies)
        if (e.alive && !e.def.flying && Math.hypot(e.x - t.x, e.y - t.y) < t.r) e.webUntil = Math.max(e.webUntil, this.time_ + 1);
      t.gfx.setAlpha(Math.min(1, (t.until - this.time_) / 2));
      if (t.until <= this.time_) t.gfx.destroy();
    }
    this.traps = this.traps.filter(t => t.until > this.time_);
  }

  /** Stationary helpers: the enemy in range that is closest to the seed. */
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

  /** Roaming helpers: the nearest enemy to them that is inside the defended area. */
  pickRoamTarget(h: Hero): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || (e.def.flying && !h.def.hitsAir)) continue;
      if (Math.hypot(e.x - SEED.x, e.y - SEED.y) > TUNING.heroLeash) continue;
      const d = Math.hypot(e.x - h.x, e.y - h.y);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  shoot(h: Hero, target: Enemy) {
    const color = h.def.damageType === 'fire' ? 0xff8a2a : TAG_COLOR[h.def.tag];
    const bolt = this.add.circle(h.x, h.y, h.def.splash ? 7 : 4, color).setDepth(4);
    // (melee attacks still use a short bolt so you can see each hit)
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
    let dmg = h.damage;
    if (d.tag === 'swarm' && e.webbed) dmg *= 1 + TUNING.feastBonus; // Feast
    if (d.damageType === 'fire' && e.webbed) this.wildfire(e); // Wildfire
    this.damage(e, dmg, d.damageType);
    if (!e.alive) return;
    if (d.webSec) e.webUntil = this.time_ + d.webSec;
    if (d.burnSec) { e.burnUntil = this.time_ + d.burnSec; e.burnDps = Math.max(d.burnDps ?? 0, e.burning ? e.burnDps : 0); }
    if (d.sunderSec) e.sunderUntil = this.time_ + d.sunderSec;
    if (d.executeBelow && !e.def.boss && (e.webbed || e.burning) && e.hp / e.def.hp < d.executeBelow) {
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
    this.stats.kills++;
    e.destroy();
  }

  // ---------- stinger ----------
  updateStinger(dt: number) {
    const p = this.input.activePointer;
    // Read the button state every frame rather than relying on press events,
    // which can be missed right after an overlay closes.
    this.stingerDown = p.isDown && !this.uiPress;
    this.reticle.setPosition(p.worldX, p.worldY).setRadius(TUNING.stinger.hitRadius * this.meta.stingerRadiusMult).setVisible(this.stingerDown);
    this.stingerCooldown -= dt;
    if (!this.stingerDown || this.stingerCooldown > 0) return;
    const st = TUNING.stinger;
    const radius = st.hitRadius * this.meta.stingerRadiusMult;
    // The Stinger hits every enemy touching the circle.
    const hits = this.enemies.filter(e => e.alive && Math.hypot(e.x - p.worldX, e.y - p.worldY) <= radius + e.def.size);
    if (!hits.length) return;
    this.stingerCooldown = 1 / (st.attacksPerSec * this.meta.stingerSpeedMult);
    this.stats.stingerHits++;
    for (const e of hits) this.damage(e, st.damage * this.meta.stingerDmgMult * (e.webbed ? 1 + st.webbedBonus : 1), 'physical');
    this.ring(p.worldX, p.worldY, radius, 0xff4d6d);
  }

  // ---------- spawning: a steady ramp, surges, then the boss ----------
  pickEnemy(): string {
    const mix = TUNING.run.mix.filter(m => this.time_ >= m.fromSec);
    let r = Math.random() * mix.reduce((a, m) => a + m.weight, 0);
    for (const m of mix) { if (r < m.weight) return m.enemy; r -= m.weight; }
    return 'grub';
  }

  /** Spawns just outside a random point on the screen edge. */
  spawn(enemy: string) {
    const def = ENEMIES[enemy];
    const m = 30 + def.size;
    let t = Math.random() * 2 * (W + H);
    let x: number, y: number;
    if (t < W) { x = t; y = -m; }
    else if ((t -= W) < H) { x = W + m; y = t; }
    else if ((t -= H) < W) { x = W - t; y = H + m; }
    else { t -= W; x = -m; y = H - t; }
    const hpScale = def.boss ? 1 : 1 + TUNING.run.hpGrowthPerMin * (this.time_ / 60);
    const e = new Enemy(this, enemy, def, x, y, SEED.x, SEED.y, SEED.r, hpScale);
    this.enemies.push(e);
    return e;
  }

  updateSpawns(dt: number) {
    const run = TUNING.run;
    const progress = Math.min(1, this.time_ / run.bossAtSec);
    let rate = run.spawnPerSecStart + (run.spawnPerSecEnd - run.spawnPerSecStart) * progress;
    if (this.bossSpawned) rate *= run.spawnRateDuringBoss;
    this.spawnDebt += rate * dt;
    while (this.spawnDebt >= 1) { this.spawnDebt--; this.spawn(this.pickEnemy()); }
    if (!this.bossSpawned && this.time_ >= this.nextSurge) {
      this.nextSurge += run.surgeEverySec;
      this.showBanner('Swarm incoming!');
      for (let i = 0; i < run.surgeSize; i++) this.spawn(this.pickEnemy());
    }
    if (!this.bossSpawned && this.time_ >= run.bossAtSec) {
      this.bossSpawned = true;
      this.boss = this.spawn('frogking');
      this.bossTongue = TUNING.boss.tongueEverySec;
      this.bossFlop = TUNING.boss.flopEverySec;
      this.showBanner('The Frog King arrives!');
      this.cameras.main.shake(400, 0.008);
    }
  }

  // ---------- the Frog King ----------
  updateBoss(dt: number) {
    const b = this.boss;
    if (!b) return;
    if (!b.alive) { this.boss = null; this.end('won'); return; }
    const cfg = TUNING.boss;
    const enraged = b.hp / b.maxHp < cfg.enrageBelow;
    b.speedMult = enraged ? cfg.enrageSpeedMult : 1;
    const cd = enraged ? cfg.enrageCooldownMult : 1;
    this.bossTongue -= dt;
    this.bossFlop -= dt;
    if (this.bossTongue <= 0) {
      this.bossTongue = cfg.tongueEverySec * cd;
      // Tongue Lash: grab the nearest helper and stun it.
      let best: Hero | null = null, bd: number = cfg.tongueRange;
      for (const h of this.heroes) if (h) { const d = Math.hypot(h.x - b.x, h.y - b.y); if (d < bd) { bd = d; best = h; } }
      if (best) {
        best.stunnedUntil = this.time_ + cfg.tongueStunSec;
        const line = this.add.line(0, 0, b.x, b.y, best.x, best.y, 0xff6b9a).setOrigin(0).setLineWidth(5).setDepth(7);
        this.tweens.add({ targets: line, alpha: 0, duration: 500, onComplete: () => line.destroy() });
        this.floatText(best.x, best.y - 34, 'GRABBED!', '#ff6b9a');
      }
    }
    if (this.bossFlop <= 0 && !b.atSeed) {
      this.bossFlop = cfg.flopEverySec * cd;
      // Belly Flop: leap toward the seed, splash out grubs on landing.
      const dx = SEED.x - b.x, dy = SEED.y - b.y, d = Math.hypot(dx, dy);
      const hop = Math.min(cfg.flopDistance, d - b.stopDist);
      b.x += (dx / d) * hop; b.y += (dy / d) * hop;
      this.ring(b.x, b.y, 110, 0x7bd36b);
      this.cameras.main.shake(200, 0.006);
      if (Math.hypot(SEED.x - b.x, SEED.y - b.y) <= b.stopDist + 5) this.seedHp -= cfg.flopSeedDamage;
      for (let i = 0; i < cfg.flopGrubs; i++) {
        const g = this.spawn('grub');
        g.x = b.x + Phaser.Math.Between(-60, 60); g.y = b.y + Phaser.Math.Between(-60, 60);
      }
    }
  }

  end(result: 'won' | 'lost') {
    if (this.state !== 'playing') return;
    this.state = result;
    this.stingerDown = false;
    this.banner.setText(result === 'won' ? 'The Heartseed survives!' : 'The Heartseed has fallen').setFontSize(36).setAlpha(1);
    // Short pause so you see what happened, then the menu takes over.
    this.time.delayedCall(1400, () => this.onEnd({ won: result === 'won', seconds: Math.round(this.time_), kills: this.stats.kills }));
  }

  // ---------- main loop ----------
  update(_t: number, deltaMs: number) {
    this.drawHud();
    if (this.state !== 'playing' || this.paused) return;
    const dt = Math.min(deltaMs / 1000, 0.05) * this.speed;
    this.time_ += dt;

    this.updateSpawns(dt);
    this.updateBoss(dt);
    if (this.state !== 'playing') return;
    this.updateStinger(dt);
    this.updateHeroes(dt);
    this.updateTraps();

    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.update(dt, this.time_, this.enemies);
      if (e.burning) this.damage(e, e.burnDps * dt, 'fire', false);
      if (e.alive && e.atSeed) this.seedHp -= e.def.seedDps * dt;
    }
    this.enemies = this.enemies.filter(e => e.alive);

    if (this.seedHp <= 0) { this.seedHp = 0; this.end('lost'); }
    this.seedBody.setFillStyle(this.enemies.some(e => e.atSeed) && Math.sin(this.time_ * 20) > 0 ? 0xd9f0c8 : 0x9be36d);
  }

  drawHud() {
    const left = TUNING.run.bossAtSec - this.time_;
    const timer = this.bossSpawned ? 'BOSS FIGHT' : `Boss in ${this.clock(left)}`;
    this.hud.setText(`${this.clock(this.time_)}   ${timer}   Kills ${this.stats.kills}`);
    this.bossBar.clear();
    this.bossLabel.setText('');
    if (this.boss?.alive) {
      const b = this.boss, bw = 500, bx = W / 2 - bw / 2, by = 60;
      this.bossLabel.setText(b.hp / b.maxHp < TUNING.boss.enrageBelow ? 'FROG KING (ENRAGED)' : 'FROG KING');
      this.bossBar.fillStyle(0x000000, 0.6).fillRect(bx, by, bw, 12);
      this.bossBar.fillStyle(0xd4af37).fillRect(bx, by, (bw * Math.max(0, b.hp)) / b.maxHp, 12);
    }
    const bw = 300, x = W - bw - 16, y = 16; // seed health, top right
    this.seedBar.clear();
    this.seedBar.fillStyle(0x000000, 0.6).fillRect(x, y, bw, 14);
    this.seedBar.fillStyle(0x9be36d).fillRect(x, y, (bw * this.seedHp) / this.maxSeedHp, 14);
    this.seedBar.lineStyle(1, 0xf0e6d2, 0.5).strokeRect(x, y, bw, 14);
  }

  clock(sec: number) {
    const t = Math.max(0, Math.floor(sec));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }

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
