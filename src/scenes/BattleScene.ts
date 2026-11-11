import Phaser from 'phaser';
import { ENEMIES, HEROES, HERO_IDS, TUNING, WAVES, DamageType, TAG_COLOR } from '../game/data';
import { Enemy } from '../game/Enemy';
import { Hero, rarityColor } from '../game/Hero';
import { packPrice, rollHero, starsFor } from '../game/packs';

export const W = 1280;
export const H = 720;
const SEED = { x: 640, y: 360, r: 40 };
const RING = 100; // distance of hero slots from the seed
const SLOTS = Array.from({ length: TUNING.heroSlots }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI * 2) / TUNING.heroSlots;
  return { x: SEED.x + Math.cos(a) * RING, y: SEED.y + Math.sin(a) * RING };
});
const RARITY_HEX: Record<string, string> = { common: '#bbbbbb', rare: '#5b9cff', epic: '#c084fc', legendary: '#ffc83d' };

interface Spawn { at: number; enemy: string; side: 'edge' | 'air' }

export class BattleScene extends Phaser.Scene {
  enemies: Enemy[] = [];
  heroes: (Hero | null)[] = [];
  seedHp = TUNING.seedHp;
  nectar = 0;
  packsBought = 0;
  waveIndex = -1;
  waveTime = 0;
  schedule: Spawn[] = [];
  breakTimer = 0;
  state: 'playing' | 'won' | 'lost' = 'playing';
  paused = false; // true while a pack is being opened
  pendingHero: string | null = null; // pulled hero waiting for a slot (board full)
  time_ = 0;
  speed = 1;
  testMode = false;
  stats = { kills: 0, wildfires: 0, executes: 0, stingerHits: 0, packs: 0 };

  stingerDown = false;
  uiPress = false; // true while a press that began on a button is held
  stingerCooldown = 0;
  reticle!: Phaser.GameObjects.Arc;
  seedBody!: Phaser.GameObjects.Arc;
  hud!: Phaser.GameObjects.Text;
  seedBar!: Phaser.GameObjects.Graphics;
  banner!: Phaser.GameObjects.Text;
  shopBtn!: Phaser.GameObjects.Rectangle;
  shopText!: Phaser.GameObjects.Text;
  overlay?: Phaser.GameObjects.Container;
  replaceUi?: Phaser.GameObjects.Container;

  constructor() { super('battle'); }

  create() {
    const q = new URLSearchParams(location.search);
    this.enemies = []; this.heroes = SLOTS.map(() => null);
    this.seedHp = TUNING.seedHp; this.nectar = 0; this.packsBought = 0;
    this.waveIndex = -1; this.waveTime = 0; this.schedule = []; this.breakTimer = 1.5;
    this.state = 'playing'; this.paused = false; this.pendingHero = null; this.time_ = 0;
    this.stats = { kills: 0, wildfires: 0, executes: 0, stingerHits: 0, packs: 0 };
    this.speed = Number(q.get('speed')) || 1;
    this.testMode = q.has('test');
    this.overlay = undefined; this.replaceUi = undefined;

    // Ground: a top-down meadow with a worn circle around the seed.
    this.add.rectangle(W / 2, H / 2, W, H, 0x23301c);
    this.add.circle(SEED.x, SEED.y, TUNING.heroLeash, 0x283522); // area roaming helpers defend
    this.add.circle(SEED.x, SEED.y, 170, 0x2d3a22);
    SLOTS.forEach(s => this.add.circle(s.x, s.y, 25, 0x000000, 0.25).setStrokeStyle(2, 0x4a5a38));
    this.seedBody = this.add.circle(SEED.x, SEED.y, SEED.r, 0x9be36d).setStrokeStyle(4, 0x3f6e2a).setDepth(1);
    this.add.text(SEED.x, SEED.y, 'SEED', { fontFamily: 'monospace', fontSize: '13px', color: '#1d3311' }).setOrigin(0.5).setDepth(1);

    this.seedBar = this.add.graphics().setDepth(9);
    this.hud = this.add.text(16, 12, '', { fontFamily: 'monospace', fontSize: '16px', color: '#f0e6d2' }).setDepth(9);
    this.banner = this.add.text(W / 2, 150, '', { fontFamily: 'monospace', fontSize: '40px', color: '#ffffff', align: 'center', stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(15);
    this.reticle = this.add.circle(0, 0, TUNING.stinger.hitRadius).setStrokeStyle(2, 0xff4d6d, 0.8).setVisible(false).setDepth(8);

    // Shop button (bottom right)
    this.shopBtn = this.add.rectangle(W - 130, H - 50, 220, 64, 0x6b4f1d).setStrokeStyle(3, 0xf2c94c).setDepth(9)
      .setInteractive({ useHandCursor: true });
    this.shopText = this.add.text(W - 130, H - 50, '', { fontFamily: 'monospace', fontSize: '18px', color: '#fff3cf', align: 'center' })
      .setOrigin(0.5).setDepth(9);
    this.shopBtn.on('pointerdown', () => this.buyPack());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.state !== 'playing') { this.scene.restart(); return; }
      // Presses that start on a button or overlay never sting.
      this.uiPress = over.some(o => o.active && o.scene) || this.paused;
      if (this.uiPress) return;
      const slot = SLOTS.findIndex(s => Math.hypot(p.worldX - s.x, p.worldY - s.y) < 26);
      if (slot >= 0 && this.pendingHero) { this.placeInSlot(slot, this.pendingHero); this.closeReplace(); return; }
      if (slot >= 0 && this.testMode) { this.cycleSlot(slot); return; }
    });
    this.input.on('pointerup', () => { this.uiPress = false; });
    this.input.on('pointerupoutside', () => { this.uiPress = false; });

    (window as unknown as { __battle: BattleScene }).__battle = this;
    this.drawHud();
    // Every run starts with one free pack.
    this.openPack(true);
  }

  // ---------- packs ----------
  buyPack() {
    if (this.paused || this.state !== 'playing' || this.pendingHero) return;
    const price = packPrice(this.packsBought);
    if (this.nectar < price) { this.floatText(this.shopBtn.x, this.shopBtn.y - 50, 'Not enough Nectar', '#ffb4b4'); return; }
    this.nectar -= price;
    this.packsBought++;
    this.openPack(false);
  }

  /** Greybox pack opening: tap the pack, see the rarity glow, tap to flip. Game pauses meanwhile. */
  openPack(free: boolean) {
    this.paused = true;
    this.stingerDown = false;
    this.stats.packs++;
    const heroId = rollHero();
    const def = HEROES[heroId];
    const c = this.add.container(0, 0).setDepth(20);
    this.overlay = c;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setInteractive();
    const title = this.add.text(W / 2, 90, free ? 'Your first pack is free' : 'Meadow Pack', { fontFamily: 'monospace', fontSize: '28px', color: '#fff3cf' }).setOrigin(0.5);
    const hint = this.add.text(W / 2, H - 70, 'Tap the pack to open it', { fontFamily: 'monospace', fontSize: '20px', color: '#cfc4ad' }).setOrigin(0.5);
    const glow = this.add.rectangle(W / 2, H / 2, 250, 340, rarityColor(def.rarity), 0).setStrokeStyle(0);
    const card = this.add.rectangle(W / 2, H / 2, 220, 310, 0x7a2e2e).setStrokeStyle(4, 0xf2c94c);
    const cardText = this.add.text(W / 2, H / 2, 'MEADOW\nPACK', { fontFamily: 'monospace', fontSize: '26px', color: '#fff3cf', align: 'center' }).setOrigin(0.5);
    c.add([dim, title, hint, glow, card, cardText]);

    let step = 0;
    dim.on('pointerdown', () => {
      if (step === 0) {
        // Torn open: show a face-down card, glowing in its rarity colour.
        step = 1;
        card.setFillStyle(0x2b2433);
        cardText.setText('?');
        hint.setText('Tap to flip');
        if (def.rarity !== 'common') {
          glow.setFillStyle(rarityColor(def.rarity), 0.5);
          this.tweens.add({ targets: glow, scale: 1.08, alpha: 0.6, yoyo: true, repeat: -1, duration: 400 });
        }
        if (def.rarity === 'legendary') this.cameras.main.shake(300, 0.01);
      } else if (step === 1) {
        step = 1.5; // flipping: ignore taps until the card is face up
        this.tweens.add({
          targets: [card, cardText], scaleX: 0, duration: 120, yoyo: true,
          onComplete: () => { step = 2; },
          onYoyo: () => {
            if (!cardText.active) return;
            card.setFillStyle(TAG_COLOR[def.tag]).setStrokeStyle(6, rarityColor(def.rarity));
            const owned = this.heroes.find(h => h?.id === heroId);
            const note = owned ? `Duplicate! ${'★'.repeat(starsFor(owned.copies + 1))}` : 'New helper';
            cardText.setText(`${def.name}\n\n${def.rarity.toUpperCase()}\n${def.tag === 'none' ? '' : def.tag.toUpperCase()}\n\n${note}`)
              .setFontSize(17).setColor('#111').setWordWrapWidth(200);
          },
        });
        hint.setText('Tap to continue');
      } else if (step === 2) {
        // Hide now, destroy a moment later: destroying an object inside its own click
        // handler leaves Phaser's pointer state stuck and the next press is ignored.
        c.setVisible(false);
        dim.disableInteractive();
        this.time.delayedCall(30, () => c.destroy());
        this.overlay = undefined;
        this.paused = false;
        this.receiveHero(heroId);
      }
    });
  }

  receiveHero(id: string) {
    const owned = this.heroes.find(h => h?.id === id);
    if (owned) {
      owned.copies++;
      const before = owned.stars;
      owned.stars = starsFor(owned.copies);
      owned.refresh();
      this.floatText(owned.x, owned.y - 34, owned.stars > before ? `${'★'.repeat(owned.stars)} STAR UP!` : `+1 copy`, '#f5d76e');
      return;
    }
    const free = this.heroes.findIndex(h => !h);
    if (free >= 0) { this.placeInSlot(free, id); return; }
    // Board full: choose a hero to replace, or discard.
    this.pendingHero = id;
    this.paused = true;
    const c = this.add.container(0, 0).setDepth(19);
    const t = this.add.text(W / 2, 40, `Board full: tap a helper to replace it with ${HEROES[id].name}`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff3cf', backgroundColor: '#000000aa', padding: { x: 10, y: 6 },
    }).setOrigin(0.5, 0);
    const btn = this.add.rectangle(W / 2, H - 50, 180, 50, 0x5a2222).setStrokeStyle(2, 0xffb4b4).setInteractive({ useHandCursor: true });
    const bt = this.add.text(W / 2, H - 50, 'Discard', { fontFamily: 'monospace', fontSize: '18px', color: '#ffe0e0' }).setOrigin(0.5);
    btn.on('pointerdown', () => this.closeReplace());
    c.add([t, btn, bt]);
    this.replaceUi = c;
  }

  closeReplace() {
    this.pendingHero = null;
    this.paused = false;
    const ui = this.replaceUi;
    ui?.setVisible(false);
    this.time.delayedCall(30, () => ui?.destroy());
    this.replaceUi = undefined;
  }

  placeInSlot(slot: number, id: string) {
    this.heroes[slot]?.destroy();
    const s = SLOTS[slot];
    this.heroes[slot] = id ? new Hero(this, id, HEROES[id], s.x, s.y) : null;
    if (id) this.floatText(s.x, s.y - 34, HEROES[id].name, '#ffffff');
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
      h.cooldown -= dt;
      const target = h.def.moves ? this.pickRoamTarget(h) : this.pickTarget(h);
      if (h.def.moves) {
        // Roamers chase enemies near the seed, then walk home when the area is clear.
        if (!target) { h.moveToward(h.homeX, h.homeY, dt); continue; }
        const inRange = h.moveToward(target.x, target.y, dt, h.def.range - 4);
        if (!inRange) continue;
        // Melee helpers pin their target in place while they fight it.
        if (h.def.range <= TUNING.meleeHoldRange) target.heldUntil = this.time_ + 0.25;
      }
      if (!target || h.cooldown > 0) continue;
      let aps = h.def.attacksPerSec;
      if (h.def.tag === 'swarm') aps *= 1 + TUNING.swarmSpeedPerAlly * (swarm - 1);
      h.cooldown = 1 / aps;
      this.shoot(h, target);
    }
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
    // Read the button state every frame rather than relying on press events,
    // which can be missed right after an overlay closes.
    this.stingerDown = p.isDown && !this.uiPress && !this.pendingHero;
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
    for (const g of WAVES[i].groups)
      for (let n = 0; n < g.count; n++) this.schedule.push({ at: (g.delay ?? 0) + n * g.every, enemy: g.enemy, side: g.side });
    this.schedule.sort((a, b) => a.at - b.at);
    this.showBanner(`Wave ${i + 1}`);
  }

  /** Spawns just outside a random point on the screen edge. */
  spawn(s: Spawn) {
    const def = ENEMIES[s.enemy];
    const m = 30;
    const per = 2 * (W + H);
    let t = Math.random() * per;
    let x: number, y: number;
    if (t < W) { x = t; y = -m; }
    else if ((t -= W) < H) { x = W + m; y = t; }
    else if ((t -= H) < W) { x = W - t; y = H + m; }
    else { t -= W; x = -m; y = H - t; }
    this.enemies.push(new Enemy(this, s.enemy, def, x, y, SEED.x, SEED.y, SEED.r));
  }

  updateWaves(dt: number) {
    if (this.waveIndex >= 0) {
      this.waveTime += dt;
      while (this.schedule.length && this.schedule[0].at <= this.waveTime) this.spawn(this.schedule.shift()!);
    }
    if (this.schedule.length || this.enemies.some(e => e.alive)) return;
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
      `\nYour helpers are gone. Next run starts fresh.\n\nWave ${this.waveIndex + 1} · ${s.kills} kills · ${s.packs} packs opened\n${s.wildfires} Wildfires · ${s.executes} executes · ${s.stingerHits} stings\n\nTap to play again`,
    ).setFontSize(24).setAlpha(1);
  }

  // ---------- main loop ----------
  update(_t: number, deltaMs: number) {
    this.drawHud();
    if (this.state !== 'playing' || this.paused) return;
    const dt = Math.min(deltaMs / 1000, 0.05) * this.speed;
    this.time_ += dt;

    this.updateWaves(dt);
    this.updateStinger(dt);
    this.updateHeroes(dt);

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
    const wave = Math.max(this.waveIndex + 1, 1);
    this.hud.setText(`Wave ${wave}/${WAVES.length}   Nectar ${this.nectar}   Enemies ${this.enemies.length + this.schedule.length}`);
    const price = packPrice(this.packsBought);
    const afford = this.nectar >= price;
    this.shopText.setText(`Buy pack\n${price} Nectar`);
    this.shopBtn.setFillStyle(afford ? 0x8a6420 : 0x3a3020).setStrokeStyle(3, afford ? 0xf2c94c : 0x6a5a3a);
    this.shopText.setColor(afford ? '#fff3cf' : '#8a7f6a');
    const bw = 400, x = W / 2 - bw / 2, y = 16;
    this.seedBar.clear();
    this.seedBar.fillStyle(0x000000, 0.6).fillRect(x, y, bw, 14);
    this.seedBar.fillStyle(0x9be36d).fillRect(x, y, (bw * this.seedHp) / TUNING.seedHp, 14);
    this.seedBar.lineStyle(1, 0xf0e6d2, 0.5).strokeRect(x, y, bw, 14);
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
