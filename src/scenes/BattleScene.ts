import Phaser from 'phaser';
import { ENEMIES, HEROES, HERO_IDS, SPELLS, TUNING, DamageType, TAG_COLOR } from '../game/data';
import { Enemy } from '../game/Enemy';
import { Hero } from '../game/Hero';
import { MetaStats, bump, openPack, variantDamage } from '../meta/meta';
import type { Loadout } from '../meta/run';
import type { SaveData } from '../meta/save';
import type { Reveal } from '../ui/reveal';
import { addArt, loadArt, makeAnims } from '../art';

export const W = 1280;
export const H = 720;
const SEED = { x: 640, y: 360, r: 40 };
/** Where a helper idles when nothing is near: spread around the seed. */
function homeFor(i: number, slots: number) {
  const a = -Math.PI / 2 + (i * Math.PI * 2) / slots + 0.3;
  const r = 85 + (i % 2) * 35;
  return { x: SEED.x + Math.cos(a) * r, y: SEED.y + Math.sin(a) * r };
}

export interface RunResult { won: boolean; seconds: number; kills: number; miniBosses: number; quests: string[] }
export interface RunSetup { loadout: Loadout; meta: MetaStats; save: SaveData; reveal: Reveal; onEnd?: (r: RunResult) => void }

interface SpellButton { id: string; box: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }
const BTN = { w: 190, h: 44 };

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
  stats = { kills: 0, wildfires: 0, executes: 0, stingerHits: 0, miniBosses: 0, packs: 0 };
  loadout: Loadout = { team: [], spells: [] };
  meta!: MetaStats;
  save!: SaveData;
  reveal!: Reveal;
  maxHelpers = TUNING.maxHelpers;
  nectar = 0;
  packsBought = 0;
  packLock = 0;
  sealed = 0; // free packs waiting to be opened (Hatchery, Big Clutch)
  hatchTimer = 0;
  miniIdx = 0; // next mini-boss in tuning.run.miniBossAtSec
  questsDone: string[] = [];
  rallyUntil = 0;
  rallyBonus = 0;
  spellCd: Record<string, { left: number; max: number }> = {};
  spellButtons: SpellButton[] = [];
  packBox!: Phaser.GameObjects.Rectangle;
  packLabel!: Phaser.GameObjects.Text;
  maxSeedHp = TUNING.seedHp;
  onEnd: (r: RunResult) => void = () => {};
  bossBar!: Phaser.GameObjects.Graphics;
  bossLabel!: Phaser.GameObjects.Text;

  stingerDown = false;
  uiPress = false; // true while a press that began on a button is held
  stingerCooldown = 0;
  reticle!: Phaser.GameObjects.Arc;
  seedBody!: Phaser.GameObjects.Arc;
  seedSprite!: Phaser.GameObjects.Sprite;
  hud!: Phaser.GameObjects.Text;
  seedBar!: Phaser.GameObjects.Graphics;
  banner!: Phaser.GameObjects.Text;

  constructor() { super('battle'); }

  init(data: RunSetup) {
    this.loadout = data.loadout ?? { team: [], spells: [] };
    this.meta = data.meta;
    this.save = data.save;
    this.reveal = data.reveal;
    this.onEnd = data.onEnd ?? (() => {});
  }

  preload() { loadArt(this); }

  create() {
    makeAnims(this);
    const q = new URLSearchParams(location.search);
    this.maxHelpers = this.meta.maxHelpers;
    this.enemies = []; this.heroes = Array.from({ length: this.maxHelpers }, () => null);
    this.maxSeedHp = (this.save.runs === 0 ? TUNING.firstRun.seedHp : TUNING.seedHp) * this.meta.seedHpMult;
    Enemy.webSlowBonus = this.meta.webSlow;
    this.seedHp = this.maxSeedHp;
    this.spawnDebt = 0; this.nextSurge = TUNING.run.surgeEverySec; this.boss = null; this.bossSpawned = false;
    this.bossTongue = 0; this.bossFlop = 0; this.traps = [];
    this.state = 'playing'; this.paused = false; this.time_ = 0;
    this.stats = { kills: 0, wildfires: 0, executes: 0, stingerHits: 0, miniBosses: 0, packs: 0 };
    this.nectar = 0; this.packsBought = 0; this.miniIdx = 0; this.questsDone = [];
    this.rallyUntil = 0; this.rallyBonus = 0; this.spellCd = {}; this.spellButtons = [];
    this.speed = Number(q.get('speed')) || 1;
    this.testMode = q.has('test');
    // ?boss skips ahead to 5 seconds before the Frog King, for testing.
    if (q.has('boss')) { this.time_ = TUNING.run.bossAtSec - 5; this.nextSurge = Infinity; }
    // ?at=95 starts the run 95 seconds in (handy for testing mini-bosses).
    if (q.has('at')) this.time_ = Number(q.get('at')) || 0;
    this.miniIdx = TUNING.run.miniBossAtSec.filter(t => t < this.time_).length;
    this.nectar = this.loadout.nectar ?? 0;
    if (q.has('nectar')) this.nectar = Number(q.get('nectar')) || 0;
    this.sealed = this.meta.startPacks;
    this.hatchTimer = this.hatcherySec;

    // Ground: a top-down meadow with a worn circle around the seed.
    this.add.rectangle(W / 2, H / 2, W, H, 0x23301c);
    this.add.circle(SEED.x, SEED.y, TUNING.heroLeash, 0x283522); // area helpers defend
    this.add.circle(SEED.x, SEED.y, 170, 0x2d3a22);
    // The seed's footprint stays a circle (enemies stop at its edge); the sprite sits on top.
    this.seedBody = this.add.circle(SEED.x, SEED.y, SEED.r, 0x1a2414, 0.6).setDepth(1);
    this.seedSprite = addArt(this, 'heartseed', SEED.x, SEED.y - 10).setDepth(1.2);

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
    this.buildPackButton();
    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.castSpell(0));
    kb.on('keydown-TWO', () => this.castSpell(1));
    kb.on('keydown-SPACE', () => this.buyPack());
    // Bring in the team bought in the shop.
    this.syncTeam();
    this.drawHud();
    this.showBanner(this.loadout.team.length ? 'Defend the Heartseed!' : 'Hold on enemies to Sting them!');
  }

  /** Makes the helpers and spell buttons on the field match the loadout (after the shop, and after each mid-run pack). */
  syncTeam() {
    this.loadout.team.forEach((m, i) => {
      if (i >= this.maxHelpers) return;
      if (this.heroes[i]?.id !== m.id) this.placeInSlot(i, m.id);
      const h = this.heroes[i]!;
      h.copies = m.copies; h.stars = m.stars; h.variant = m.variant ?? 'standard'; h.refresh();
    });
    for (const b of this.spellButtons) { b.box.destroy(); b.fill.destroy(); b.label.destroy(); }
    this.spellButtons = this.loadout.spells.map((sp, i) => {
      const x = 16 + i * (BTN.w + 10), y = H - BTN.h - 14;
      const color = TAG_COLOR[SPELLS[sp.id].tag];
      const box = this.add.rectangle(x, y, BTN.w, BTN.h, 0x1a2013, 0.92).setOrigin(0).setStrokeStyle(2, color).setDepth(10)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.castSpell(i));
      const fill = this.add.rectangle(x, y, BTN.w, BTN.h, 0x000000, 0.6).setOrigin(0).setDepth(11);
      const label = this.add.text(x + BTN.w / 2, y + BTN.h / 2, '', { fontFamily: 'monospace', fontSize: '13px', color: '#f0e6d2', align: 'center' }).setOrigin(0.5).setDepth(12);
      return { id: sp.id, box, fill, label };
    });
  }

  // ---------- spells ----------
  castSpell(i: number) {
    const sp = this.loadout.spells[i];
    if (!sp || this.paused || this.reveal.active || this.state !== 'playing' || (this.spellCd[sp.id]?.left ?? 0) > 0) return;
    const d = SPELLS[sp.id];
    const power = Math.pow(TUNING.spells.starPower, sp.stars - 1);
    const max = (d.cooldown * Math.pow(TUNING.spells.starHaste, sp.stars - 1)) / (1 + this.meta.spellHaste);
    this.spellCd[sp.id] = { left: max, max };
    if (d.webSec) {
      for (const e of this.enemies) if (e.alive) e.webUntil = Math.max(e.webUntil, this.time_ + d.webSec * power + this.meta.webSec);
    }
    if (d.burnSec) {
      let fires = d.maxWildfires ?? 0;
      for (const e of [...this.enemies]) {
        if (!e.alive) continue;
        if (e.webbed && fires > 0) { fires--; this.wildfire(e); }
        if (!e.alive) continue;
        e.burnUntil = Math.max(e.burnUntil, this.time_ + d.burnSec * power);
        e.burnDps = Math.max(e.burnDps, (d.burnDps ?? 0) * this.meta.burnMult);
      }
    }
    if (d.rallySec) { this.rallyUntil = this.time_ + d.rallySec * power; this.rallyBonus = d.rallyBonus ?? 0; }
    this.showBanner(`${d.icon} ${d.name}!`);
    this.cameras.main.flash(180, ...this.rgb(TAG_COLOR[d.tag]));
  }

  rgb(c: number): [number, number, number] { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }

  get rallying() { return this.rallyUntil > this.time_; }

  drawSpells(dt: number) {
    this.spellButtons.forEach((b, i) => {
      const sp = this.loadout.spells[i];
      const cd = this.spellCd[b.id];
      if (cd && cd.left > 0) cd.left = Math.max(0, cd.left - dt);
      const ratio = cd && cd.max ? cd.left / cd.max : 0;
      b.fill.setDisplaySize(BTN.w * ratio, BTN.h).setVisible(ratio > 0);
      const d = SPELLS[b.id];
      b.label.setText(`[${i + 1}] ${d.name} ${'★'.repeat(sp?.stars ?? 1)}\n${ratio > 0 ? Math.ceil(cd!.left) + ' s' : 'READY'}`);
      b.box.setFillStyle(ratio > 0 ? 0x1a2013 : 0x2f3a24, 0.92);
    });
  }

  // ---------- Nectar and mid-run packs ----------
  get packPrice() { return Math.round(TUNING.nectar.packPrice * Math.pow(TUNING.nectar.priceGrowth, this.packsBought)); }

  buildPackButton() {
    const x = W - BTN.w - 16, y = H - BTN.h - 14;
    this.packBox = this.add.rectangle(x, y, BTN.w, BTN.h, 0x241f14, 0.92).setOrigin(0).setStrokeStyle(2, 0xf2c94c).setDepth(10)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.buyPack());
    this.packLabel = this.add.text(x + BTN.w / 2, y + BTN.h / 2, '', { fontFamily: 'monospace', fontSize: '13px', color: '#f0e6d2', align: 'center' }).setOrigin(0.5).setDepth(12);
    this.packBox.setVisible(TUNING.nectar.enabled); this.packLabel.setVisible(TUNING.nectar.enabled);
    // Meadow Pack sprite peeking over the button's left edge.
    this.add.sprite(x - 8, y + BTN.h / 2 - 4, 'pack_meadow', 0).setScale(1.5).setAngle(-12).setDepth(12).setVisible(TUNING.nectar.enabled).play('pack_meadow-idle');
  }

  /** Seconds between free Hatchery packs (Infinity without the node). */
  get hatcherySec() {
    const lv = this.meta.hatchery;
    return lv ? TUNING.nectar.hatcherySec[Math.min(lv, TUNING.nectar.hatcherySec.length) - 1] : Infinity;
  }

  /**
   * Opens a sealed pack if you have one, otherwise spends Nectar on a new one.
   * The fight keeps going in slow motion while you flip, so ripping fast matters.
   */
  buyPack() {
    if (!TUNING.nectar.enabled || this.paused || this.reveal.active || performance.now() < this.packLock || this.state !== 'playing') return;
    if (this.sealed > 0) this.sealed--;
    else if (this.nectar >= this.packPrice) { this.nectar -= this.packPrice; this.packsBought++; }
    else return;
    this.stats.packs++;
    this.uiPress = true; // don't sting with the press that bought the pack
    const cards = openPack(TUNING.nectar.packType, this.meta, this.save);
    this.quests(bump(this.save, 'packs'));
    this.reveal.show(cards, this.loadout, () => this.meta, () => {
      this.quests(this.reveal.questNews.splice(0));
      this.syncTeam();
      this.packLock = performance.now() + 250; // the Space press that kept the card shouldn't buy another pack
    }, true);
  }

  quests(names: string[]) {
    for (const n of names) {
      this.questsDone.push(n);
      this.floatText(SEED.x, SEED.y - 70, `📜 Quest complete: ${n}`, '#ffd76e');
    }
  }

  placeInSlot(slot: number, id: string) {
    const old = this.heroes[slot];
    old?.destroy();
    const home = homeFor(slot, this.maxHelpers);
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
      let aps = h.def.attacksPerSec * this.meta.helperSpeedMult;
      if (h.def.tag === 'swarm') aps *= (1 + (TUNING.swarmSpeedPerAlly + this.meta.swarmPerAlly) * (swarm - 1)) * (this.rallying ? 1 + this.rallyBonus : 1);
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
        // Ricochet: ranged single-target shots bounce on to nearby enemies.
        if (!h.def.splash && h.def.range >= 150) {
          let from = target; const done = new Set([target]);
          for (let k = 0; k < this.meta.bounces; k++) {
            const next = this.enemies.find(e => e.alive && !done.has(e) && (h.def.hitsAir || !e.def.flying) && Math.hypot(e.x - from.x, e.y - from.y) < 130);
            if (!next) break;
            const line = this.add.line(0, 0, from.x, from.y, next.x, next.y, color).setOrigin(0).setLineWidth(2).setDepth(4);
            this.tweens.add({ targets: line, alpha: 0, duration: 200, onComplete: () => line.destroy() });
            this.applyHit(h, next, 0.6);
            done.add(next); from = next;
          }
        }
      },
    });
  }

  applyHit(h: Hero, e: Enemy, mult = 1) {
    if (!e.alive) return;
    const d = h.def;
    let dmg = mult * h.damage * (1 + (d.rarity === 'common' ? this.meta.commonDmg : 0) + (this.meta.heroDmg[h.id] ?? 0) + variantDamage(h.variant));
    if (Math.random() < this.meta.critChance) { dmg *= 2; this.floatText(e.x, e.y - 32, 'CRIT', '#ffd76e'); }
    if (d.tag === 'swarm' && e.webbed) dmg *= 1 + TUNING.feastBonus; // Feast
    if (d.damageType === 'fire' && e.webbed) this.wildfire(e); // Wildfire
    this.damage(e, dmg, d.damageType);
    if (!e.alive) return;
    if (d.webSec) e.webUntil = this.time_ + d.webSec + this.meta.webSec;
    if (d.burnSec) { e.burnUntil = this.time_ + d.burnSec; e.burnDps = Math.max((d.burnDps ?? 0) * this.meta.burnMult, e.burning ? e.burnDps : 0); }
    if (d.sunderSec) e.sunderUntil = this.time_ + d.sunderSec;
    if (d.executeBelow && !e.def.boss && (e.webbed || e.burning) && e.hp / e.def.hp < d.executeBelow) {
      this.stats.executes++;
      bump(this.save, 'executes');
      this.floatText(e.x, e.y - 30, 'EXECUTE', '#f5b301');
      this.kill(e);
    }
  }

  wildfire(origin: Enemy) {
    const wf = TUNING.wildfire;
    const radius = wf.radius * (1 + this.meta.wildfireRadius);
    this.stats.wildfires++;
    this.quests(bump(this.save, 'wildfires'));
    origin.webUntil = 0;
    this.ring(origin.x, origin.y, radius, 0xff5a1f);
    this.floatText(origin.x, origin.y - 34, 'WILDFIRE!', '#ff8a2a');
    for (const e of this.enemies) {
      if (!e.alive || Math.hypot(e.x - origin.x, e.y - origin.y) > radius) continue;
      this.damage(e, wf.burst * this.meta.burnMult, 'fire');
      if (e.alive) { e.burnUntil = this.time_ + wf.burnSec; e.burnDps = Math.max(e.burnDps, wf.burnDps * this.meta.burnMult); }
    }
  }

  damage(e: Enemy, amount: number, type: DamageType, showNumber = true) {
    if (!e.alive) return;
    if (type === 'physical') {
      if (e.def.physicalImmune) { if (showNumber) this.floatText(e.x, e.y - 20, 'IMMUNE', '#b07cff'); return; }
      const armor = e.sundered ? e.def.armor * (1 - TUNING.sunderArmorCut) : e.def.armor;
      amount *= 1 - armor;
    }
    if (e.def.boss) amount *= 1 + this.meta.bossVuln;
    e.hp -= amount;
    if (showNumber) this.floatText(e.x + Phaser.Math.Between(-8, 8), e.y - 20, String(Math.round(amount)), type === 'fire' ? '#ffb070' : '#ffffff');
    if (e.hp <= 0) this.kill(e);
  }

  kill(e: Enemy) {
    if (!e.alive) return;
    this.stats.kills++;
    this.nectar += TUNING.nectar.perKill * this.meta.nectarMult;
    if (e.def.miniBoss) {
      this.stats.miniBosses++;
      this.nectar += TUNING.nectar.miniBossBounty;
      this.floatText(e.x, e.y - 40, `Toad Brute down! +${TUNING.nectar.miniBossBounty} Nectar`, '#ffd76e');
    }
    this.seedHp = Math.min(this.maxSeedHp, this.seedHp + this.meta.healPerKill);
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
    this.stingerCooldown = 1 / (st.attacksPerSec * this.meta.stingerSpeedMult * (this.rallying ? 1 + this.rallyBonus : 1));
    this.stats.stingerHits++;
    const webbed = hits.filter(e => e.webbed).length;
    if (webbed) this.quests(bump(this.save, 'webStings', webbed));
    for (const e of hits) this.damage(e, st.damage * this.meta.stingerDmgMult * (e.webbed ? 1 + st.webbedBonus + this.meta.stingerWebBonus : 1), 'physical');
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
    const rush = run.openingRush;
    if (this.time_ >= rush.atSec && this.time_ - dt < rush.atSec) {
      for (let i = 0; i < rush.count; i++) {
        const g = this.spawn('grub');
        const ang = (i / rush.count) * Math.PI * 2 + Math.random() * 0.5;
        g.x = SEED.x + Math.cos(ang) * rush.distance; g.y = SEED.y + Math.sin(ang) * rush.distance * 0.8;
        this.ring(g.x, g.y, 22, 0x6fae4a);
      }
    }
    if (!this.bossSpawned && this.time_ >= (run.miniBossAtSec[this.miniIdx] ?? Infinity)) {
      this.miniIdx++;
      this.spawn(TUNING.miniBoss.enemy).timer = TUNING.miniBoss.eatEverySec;
      this.showBanner('A Toad Brute appears!');
      this.cameras.main.shake(250, 0.005);
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

  // ---------- Toad Brute (mini-boss): swallows a nearby grub to heal ----------
  updateMiniBosses(dt: number) {
    const cfg = TUNING.miniBoss;
    for (const t of this.enemies) {
      if (!t.alive || !t.def.miniBoss) continue;
      t.timer -= dt;
      if (t.timer > 0 || t.hp >= t.maxHp) continue;
      const snack = this.enemies.find(e => e.alive && e.id === 'grub' && Math.hypot(e.x - t.x, e.y - t.y) < cfg.eatRange);
      if (!snack) continue;
      t.timer = cfg.eatEverySec;
      const line = this.add.line(0, 0, t.x, t.y, snack.x, snack.y, 0xff6b9a).setOrigin(0).setLineWidth(4).setDepth(7);
      this.tweens.add({ targets: line, alpha: 0, duration: 350, onComplete: () => line.destroy() });
      snack.destroy();
      const heal = Math.min(t.maxHp - t.hp, t.maxHp * cfg.healFrac);
      t.hp += heal;
      this.floatText(t.x, t.y - 44, `GULP +${Math.round(heal)}`, '#7bd36b');
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
    if (result === 'won') this.quests(bump(this.save, 'bossKills'));
    this.banner.setText(result === 'won' ? 'The Heartseed survives!' : 'The Heartseed has fallen').setFontSize(36).setAlpha(1);
    // Short pause so you see what happened, then the menu takes over.
    this.time.delayedCall(1400, () => this.onEnd({
      won: result === 'won', seconds: Math.round(this.time_), kills: this.stats.kills, miniBosses: this.stats.miniBosses, quests: this.questsDone,
    }));
  }

  // ---------- main loop ----------
  update(_t: number, deltaMs: number) {
    this.drawHud();
    if (this.state !== 'playing' || this.paused) return;
    const slow = this.reveal.active ? TUNING.nectar.revealTimeScale : 1;
    const dt = Math.min(deltaMs / 1000, 0.05) * this.speed * slow;
    this.time_ += dt;
    this.hatchTimer -= dt;
    if (this.hatchTimer <= 0) {
      this.hatchTimer = this.hatcherySec;
      this.sealed++;
      this.floatText(W - BTN.w / 2 - 16, H - BTN.h - 30, '🪺 A pack hatched!', '#ffd76e');
    }

    this.updateSpawns(dt);
    this.updateMiniBosses(dt);
    this.updateBoss(dt);
    if (this.state !== 'playing') return;
    this.updateStinger(dt);
    this.drawSpells(dt);
    this.updateHeroes(dt);
    this.updateTraps();

    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.update(dt, this.time_, this.enemies);
      if (e.burning) this.damage(e, e.burnDps * dt, 'fire', false);
      if (e.alive && e.atSeed) this.seedHp -= e.def.seedDps * dt;
    }
    this.enemies = this.enemies.filter(e => e.alive);

    this.seedHp = Math.min(this.maxSeedHp, this.seedHp + this.meta.seedRegen * dt);
    if (this.seedHp <= 0) { this.seedHp = 0; this.end('lost'); }
    if (this.enemies.some(e => e.atSeed) && Math.sin(this.time_ * 20) > 0) this.seedSprite.setTint(0xff9b9b);
    else this.seedSprite.clearTint();
  }

  drawHud() {
    const left = TUNING.run.bossAtSec - this.time_;
    const timer = this.bossSpawned ? 'BOSS FIGHT' : `Boss in ${this.clock(left)}`;
    const nectarOn = TUNING.nectar.enabled;
    this.hud.setText(`${this.clock(this.time_)}   ${timer}   Kills ${this.stats.kills}${nectarOn ? `   Nectar ${Math.floor(this.nectar)}` : ''}${this.rallying ? '   RALLY!' : ''}`);
    if (nectarOn) {
      const can = this.sealed > 0 || this.nectar >= this.packPrice;
      const line2 = this.sealed > 0 ? `${this.sealed} sealed, free` : `${Math.floor(this.nectar)} / ${this.packPrice} Nectar`;
      this.packLabel.setText(`Open a pack [Space]\n${line2}`).setColor(can ? '#1b1405' : '#a59a84');
      this.packBox.setFillStyle(can ? 0xf2c94c : 0x241f14, 0.92);
    }
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
