import shopJson from '../data/shop.json';
import treeJson from '../data/tree.json';
import { HEROES, HERO_IDS, HeroDef } from '../game/data';
import { SaveData, Variant } from './save';

export type Rarity = HeroDef['rarity'];
export interface ShopItem { name: string; cost: number; packs: number; packType: string; weight: number; requires?: string }
export interface TreeNode {
  branch: string; name: string; desc: string; icon: string; cost: number[]; effect: Record<string, number>;
  parent?: string; hero?: string; tier?: 'early' | 'core' | 'late';
}
export interface Branch { color: string; angle: number; blurb: string }
export interface Pull { id: string; variant: Variant }

export const SHOP = shopJson as {
  offerSlots: number; rerollCost: number; items: Record<string, ShopItem>;
  packTypes: Record<string, { odds: Record<Rarity, number> }>;
  variants: Record<'foil' | 'holo', { chance: number; damage: number }>;
  brood: { hatchMinutes: number };
};
export const TREE_DATA = treeJson as {
  branches: Record<string, Branch>; nodes: Record<string, TreeNode>;
  legends: { cost: number[]; dmgPerRank: number; icons: Record<string, string>; parents: Record<string, string> };
};

/** All tree nodes, including one generated Legends node per hero ("hero:ant", ...). */
export const TREE = {
  branches: TREE_DATA.branches,
  nodes: {
    ...TREE_DATA.nodes,
    ...Object.fromEntries(HERO_IDS.map(id => [`hero:${id}`, {
      branch: 'Legends', name: HEROES[id].name, desc: `${HEROES[id].name} +20% damage`, icon: TREE_DATA.legends.icons[id] ?? '🐞',
      cost: TREE_DATA.legends.cost, effect: {}, hero: id, tier: 'core',
      parent: TREE_DATA.legends.parents[id] ? `hero:${TREE_DATA.legends.parents[id]}` : undefined,
    } as TreeNode])),
  } as Record<string, TreeNode>,
};

/** Stats that come from the skill tree. */
export interface MetaStats {
  maxGold: number; freeRerolls: number; offerSlots: number; seedHpMult: number; masteryMult: number;
  stingerDmgMult: number; stingerSpeedMult: number; stingerRadiusMult: number;
  helperSpeedMult: number; commonDmg: number; webSec: number; webSlow: number; burnMult: number; swarmPerAlly: number;
  bonusCardChance: number; critChance: number; bounces: number; healPerKill: number; seedRegen: number; bossVuln: number;
  combs: number; hatchSpeed: number; twinChance: number; jellyChance: number;
  rarityBoost: number; legendaryBoost: number; foilChance: number; holoChance: number;
  heroDmg: Record<string, number>; // extra damage per hero from Legends nodes
}

export function metaStats(save: SaveData): MetaStats {
  const s: MetaStats = {
    maxGold: 1, freeRerolls: 0, offerSlots: SHOP.offerSlots, seedHpMult: 1, masteryMult: 1,
    stingerDmgMult: 1, stingerSpeedMult: 1, stingerRadiusMult: 1,
    helperSpeedMult: 1, commonDmg: 0, webSec: 0, webSlow: 0, burnMult: 1, swarmPerAlly: 0, heroDmg: {},
    bonusCardChance: 0, critChance: 0, bounces: 0, healPerKill: 0, seedRegen: 0, bossVuln: 0,
    combs: 0, hatchSpeed: 0, twinChance: 0, jellyChance: 0,
    rarityBoost: 0, legendaryBoost: 0, foilChance: SHOP.variants.foil.chance, holoChance: SHOP.variants.holo.chance,
  };
  for (const [id, rank] of Object.entries(save.nodes)) {
    const node = TREE.nodes[id];
    if (!node) continue;
    if (node.hero) { s.heroDmg[node.hero] = TREE_DATA.legends.dmgPerRank * rank; continue; }
    for (const [k, v] of Object.entries(node.effect)) (s as unknown as Record<string, number>)[k] += v * rank;
  }
  return s;
}

/** A node can be bought once its parent has a rank (Legends: once you've pulled that hero). */
export function nodeUnlocked(save: SaveData, id: string) {
  const n = TREE.nodes[id];
  if (n.hero) return save.pulled.includes(n.hero);
  return !n.parent || (save.nodes[n.parent] ?? 0) > 0;
}

export function itemUnlocked(save: SaveData, id: string) {
  const req = SHOP.items[id].requires;
  return !req || (save.nodes[req] ?? 0) > 0;
}

/** Fills the shop slots with random unlocked items. */
export function rollOffers(save: SaveData): string[] {
  const pool = Object.keys(SHOP.items).filter(id => itemUnlocked(save, id));
  const total = pool.reduce((a, id) => a + SHOP.items[id].weight, 0);
  return Array.from({ length: metaStats(save).offerSlots }, () => {
    let r = Math.random() * total;
    for (const id of pool) { if (r < SHOP.items[id].weight) return id; r -= SHOP.items[id].weight; }
    return pool[0];
  });
}

/** Rarity odds (in %) for a pack type after Fortune upgrades. */
export function packOdds(packType: string, m: MetaStats): Record<Rarity, number> {
  const base = SHOP.packTypes[packType].odds;
  const w: Record<Rarity, number> = {
    common: base.common,
    rare: base.rare * (1 + m.rarityBoost),
    epic: base.epic * (1 + m.rarityBoost),
    legendary: base.legendary * (1 + m.rarityBoost) * (1 + m.legendaryBoost),
  };
  const total = w.common + w.rare + w.epic + w.legendary;
  for (const k of Object.keys(w) as Rarity[]) w[k] = (w[k] / total) * 100;
  return w;
}

/** One card from a pack of the given type, with its variant. */
export function rollCard(packType: string, m: MetaStats): Pull {
  const odds = packOdds(packType, m);
  let r = Math.random() * 100;
  let rarity: Rarity = 'common';
  for (const [k, v] of Object.entries(odds) as [Rarity, number][]) { if (r < v) { rarity = k; break; } r -= v; }
  const pool = HERO_IDS.filter(id => HEROES[id].rarity === rarity);
  const id = pool[Math.floor(Math.random() * pool.length)];
  const v = Math.random();
  const variant: Variant = v < m.holoChance ? 'holo' : v < m.holoChance + m.foilChance ? 'foil' : 'standard';
  return { id, variant };
}

/** All the cards in one pack (Lucky Rip can add a bonus card). */
export function openPack(packType: string, m: MetaStats): Pull[] {
  const cards = [rollCard(packType, m)];
  if (Math.random() < m.bonusCardChance) cards.push(rollCard(packType, m));
  return cards;
}

export const VARIANT_RANK: Record<Variant, number> = { standard: 0, foil: 1, holo: 2 };
export function variantDamage(v: Variant | undefined) { return v && v !== 'standard' ? SHOP.variants[v].damage : 0; }

// ---------- brood combs (timed pack generators) ----------
export function hatchMs(m: MetaStats) { return (SHOP.brood.hatchMinutes * 60000) / (1 + m.hatchSpeed); }

/** Makes sure there is one timer per comb you own. A new comb arrives with its first egg ready to hatch. */
export function syncCombs(save: SaveData, m: MetaStats, now = Date.now()) {
  while (save.combs.length < m.combs) save.combs.push(now - hatchMs(m));
  if (save.combs.length > m.combs) save.combs.length = m.combs;
}

export function combProgress(save: SaveData, i: number, m: MetaStats, now = Date.now()) {
  const p = (now - save.combs[i]) / hatchMs(m);
  return { ratio: Math.min(1, p), ready: p >= 1, msLeft: Math.max(0, hatchMs(m) - (now - save.combs[i])) };
}

/** Hatches a ready comb. Returns the pack types that came out. */
export function hatchComb(save: SaveData, i: number, m: MetaStats, now = Date.now()): string[] {
  if (!combProgress(save, i, m, now).ready) return [];
  save.combs[i] = now;
  const one = () => (Math.random() < m.jellyChance ? 'grove' : 'meadow');
  return Math.random() < m.twinChance ? [one(), one()] : [one()];
}

/** Gives back all Mastery spent (free while costs are still being tuned). */
export function refundAll(save: SaveData) {
  for (const [id, rank] of Object.entries(save.nodes)) {
    const node = TREE.nodes[id];
    if (node) for (let i = 0; i < rank; i++) save.mastery += node.cost[i];
  }
  save.nodes = {};
  save.combs = [];
}

/** Mastery earned from a run. */
export function masteryFor(kills: number, seconds: number, bossKilled: boolean, mult: number) {
  return Math.round((kills * 0.5 + seconds / 10 + (bossKilled ? 100 : 0)) * mult);
}
