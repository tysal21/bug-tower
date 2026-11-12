import shopJson from '../data/shop.json';
import treeJson from '../data/tree.json';
import { HEROES, HERO_IDS, HeroDef } from '../game/data';
import { SaveData } from './save';

export interface ShopItem { name: string; cost: number; packs: number; packType: string; weight: number; requires?: string }
export interface TreeNode { branch: string; name: string; desc: string; cost: number[]; effect: Record<string, number>; requires?: string; hero?: string; tier?: 'early' | 'core' | 'late' }

export const SHOP = shopJson as { offerSlots: number; rerollCost: number; items: Record<string, ShopItem>; packTypes: Record<string, { odds: Record<HeroDef['rarity'], number> }> };
export const TREE_DATA = treeJson as { branches: string[]; nodes: Record<string, TreeNode>; legends: { cost: number[]; dmgPerRank: number } };

/** All tree nodes, including one generated Legends node per hero ("hero:ant", ...). */
export const TREE = {
  branches: TREE_DATA.branches,
  nodes: {
    ...TREE_DATA.nodes,
    ...Object.fromEntries(HERO_IDS.map(id => [`hero:${id}`, {
      branch: 'Legends', name: HEROES[id].name, desc: `${HEROES[id].name} +20% damage`,
      cost: TREE_DATA.legends.cost, effect: {}, hero: id, tier: 'core',
    } as TreeNode])),
  } as Record<string, TreeNode>,
};

/** Stats that come from the skill tree. */
export interface MetaStats {
  maxGold: number; freeRerolls: number; seedHpMult: number; masteryMult: number;
  stingerDmgMult: number; stingerSpeedMult: number; stingerRadiusMult: number;
  helperSpeedMult: number; commonDmg: number; webSec: number; webSlow: number; burnMult: number; swarmPerAlly: number;
  bonusCardChance: number; critChance: number; bounces: number; healPerKill: number; seedRegen: number; bossVuln: number;
  heroDmg: Record<string, number>; // extra damage per hero from Legends nodes
}

export function metaStats(save: SaveData): MetaStats {
  const s: MetaStats = {
    maxGold: 1, freeRerolls: 0, seedHpMult: 1, masteryMult: 1, stingerDmgMult: 1, stingerSpeedMult: 1, stingerRadiusMult: 1,
    helperSpeedMult: 1, commonDmg: 0, webSec: 0, webSlow: 0, burnMult: 1, swarmPerAlly: 0, heroDmg: {},
    bonusCardChance: 0, critChance: 0, bounces: 0, healPerKill: 0, seedRegen: 0, bossVuln: 0,
  };
  for (const [id, rank] of Object.entries(save.nodes)) {
    const node = TREE.nodes[id];
    if (!node) continue;
    if (node.hero) { s.heroDmg[node.hero] = TREE_DATA.legends.dmgPerRank * rank; continue; }
    for (const [k, v] of Object.entries(node.effect)) (s as unknown as Record<string, number>)[k] += v * rank;
  }
  return s;
}

/** Legends nodes only show for heroes you've pulled at least once. */
export function nodeVisible(save: SaveData, id: string) {
  const hero = TREE.nodes[id].hero;
  return !hero || save.pulled.includes(hero);
}

export function nodeUnlocked(save: SaveData, id: string) {
  const req = TREE.nodes[id].requires;
  return !req || (save.nodes[req] ?? 0) > 0;
}

export function itemUnlocked(save: SaveData, id: string) {
  const req = SHOP.items[id].requires;
  return !req || (save.nodes[req] ?? 0) > 0;
}

/** Fills the shop slots with random unlocked items. */
export function rollOffers(save: SaveData): string[] {
  const pool = Object.keys(SHOP.items).filter(id => itemUnlocked(save, id));
  const total = pool.reduce((a, id) => a + SHOP.items[id].weight, 0);
  return Array.from({ length: SHOP.offerSlots }, () => {
    let r = Math.random() * total;
    for (const id of pool) { if (r < SHOP.items[id].weight) return id; r -= SHOP.items[id].weight; }
    return pool[0];
  });
}

/** One card from a pack of the given type. */
export function rollCard(packType: string): string {
  const odds = SHOP.packTypes[packType].odds;
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let rarity: HeroDef['rarity'] = 'common';
  for (const [k, v] of Object.entries(odds) as [HeroDef['rarity'], number][]) { if (r < v) { rarity = k; break; } r -= v; }
  const pool = HERO_IDS.filter(id => HEROES[id].rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Gives back all Mastery spent (free while costs are still being tuned). */
export function refundAll(save: SaveData) {
  for (const [id, rank] of Object.entries(save.nodes)) {
    const node = TREE.nodes[id];
    if (node) for (let i = 0; i < rank; i++) save.mastery += node.cost[i];
  }
  save.nodes = {};
}

/** Mastery earned from a run. */
export function masteryFor(kills: number, seconds: number, bossKilled: boolean, mult: number) {
  return Math.round((kills * 0.5 + seconds / 10 + (bossKilled ? 100 : 0)) * mult);
}
