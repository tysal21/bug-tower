import shopJson from '../data/shop.json';
import treeJson from '../data/tree.json';
import { HEROES, HERO_IDS, HeroDef, SPELL_IDS, TUNING } from '../game/data';
import { SaveData, Variant } from './save';

export type Rarity = HeroDef['rarity'];
export interface ShopItem {
  name: string; cost: number; packs: number; packType: string; weight: number;
  guaranteed?: boolean; requiresIncome?: number; requiresChapter?: number; bonusMastery?: number;
}
export interface TreeNode {
  branch: string; name: string; desc: string; icon: string; cost: number[]; effect: Record<string, number>;
  parent?: string; hero?: string; tier?: 'early' | 'core' | 'late';
  /** Quest nodes are earned by doing something instead of spending Mastery. */
  quest?: { counter: string; goal: number; task: string };
}
export interface Branch { color: string; angle: number; blurb: string }
export interface Pull { id: string; variant: Variant; kind: 'hero' | 'spell' }

export const SHOP = shopJson as {
  income: number; offerSlots: number; rerollCost: number; items: Record<string, ShopItem>;
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
  maxHelpers: number; nectarMult: number; honey: number; fieldCombs: number; heartwoodMult: number; spellHaste: number; wildfireRadius: number; stingerWebBonus: number; antStart: number;
  heroDmg: Record<string, number>; // extra damage per hero from Legends nodes
}

export function metaStats(save: SaveData): MetaStats {
  const s: MetaStats = {
    maxGold: SHOP.income, freeRerolls: 0, offerSlots: SHOP.offerSlots, seedHpMult: 1, masteryMult: 1,
    stingerDmgMult: 1, stingerSpeedMult: 1, stingerRadiusMult: 1,
    helperSpeedMult: 1, commonDmg: 0, webSec: 0, webSlow: 0, burnMult: 1, swarmPerAlly: 0, heroDmg: {},
    bonusCardChance: 0, critChance: 0, bounces: 0, healPerKill: 0, seedRegen: 0, bossVuln: 0,
    combs: 0, hatchSpeed: 0, twinChance: 0, jellyChance: 0,
    rarityBoost: 0, legendaryBoost: 0, foilChance: SHOP.variants.foil.chance, holoChance: SHOP.variants.holo.chance,
    maxHelpers: TUNING.maxHelpers, nectarMult: 1, honey: 0, fieldCombs: 0,
    heartwoodMult: 1 + save.heartwood * TUNING.chapters.heartwoodMastery, spellHaste: 0, wildfireRadius: 0, stingerWebBonus: 0, antStart: 0,
  };
  const add = (effect: Record<string, number>, times: number) => {
    for (const [k, v] of Object.entries(effect)) (s as unknown as Record<string, number>)[k] += v * times;
  };
  for (const [id, rank] of Object.entries(save.nodes)) {
    const node = TREE.nodes[id];
    if (!node || node.quest) continue;
    if (node.hero) { s.heroDmg[node.hero] = TREE_DATA.legends.dmgPerRank * rank; continue; }
    add(node.effect, rank);
  }
  // Quest rewards switch on by themselves once the goal is reached.
  for (const [id, node] of Object.entries(TREE.nodes)) if (node.quest && questDone(save, id)) add(node.effect, 1);
  return s;
}

// ---------- quests ----------
export function questProgress(save: SaveData, id: string) {
  const q = TREE.nodes[id].quest!;
  return Math.min(q.goal, save.counters[q.counter] ?? 0);
}
export function questDone(save: SaveData, id: string) {
  const q = TREE.nodes[id].quest;
  return !!q && (save.counters[q.counter] ?? 0) >= q.goal;
}
export const QUEST_IDS = Object.keys(TREE.nodes).filter(id => TREE.nodes[id].quest);

/** Adds to a quest counter. Returns the names of any quests this just finished. */
export function bump(save: SaveData, counter: string, n = 1): string[] {
  save.counters[counter] = (save.counters[counter] ?? 0) + n;
  const fresh: string[] = [];
  for (const id of QUEST_IDS) {
    if (TREE.nodes[id].quest!.counter !== counter || save.questsDone.includes(id) || !questDone(save, id)) continue;
    save.questsDone.push(id);
    fresh.push(TREE.nodes[id].name);
  }
  return fresh;
}

/** A node can be bought once its parent has a rank (Legends: once you've pulled that hero). */
export function nodeUnlocked(save: SaveData, id: string) {
  const n = TREE.nodes[id];
  if (n.quest) return true; // quests always count, whatever you own
  if (n.hero) return save.pulled.includes(n.hero);
  return !n.parent || (save.nodes[n.parent] ?? 0) > 0;
}

/** Bigger buys unlock with your income (Bundle Box) or by beating chapter bosses (Grove and Elder Packs). */
export function itemUnlocked(save: SaveData, id: string, m = metaStats(save)) {
  const it = SHOP.items[id];
  return m.maxGold >= (it.requiresIncome ?? 0) && save.chapter >= (it.requiresChapter ?? 0);
}

/** Fills the shop slots with random unlocked items. */
export function rollOffers(save: SaveData, slots = metaStats(save).offerSlots): string[] {
  const m = metaStats(save);
  const open = Object.keys(SHOP.items).filter(id => itemUnlocked(save, id, m));
  const fixed = open.filter(id => SHOP.items[id].guaranteed);
  const pool = open.filter(id => SHOP.items[id].weight > 0);
  const total = pool.reduce((a, id) => a + SHOP.items[id].weight, 0);
  const random = () => {
    let r = Math.random() * total;
    for (const id of pool) { if (r < SHOP.items[id].weight) return id; r -= SHOP.items[id].weight; }
    return pool[0];
  };
  return Array.from({ length: slots }, (_, i) => fixed[i] ?? random());
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

const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/** One card from a pack of the given type, with its variant. minRarity is used by the pity rule. */
export function rollCard(packType: string, m: MetaStats, minRarity?: Rarity): Pull {
  if (!minRarity && Math.random() < TUNING.spells.chancePerCard) {
    return { id: SPELL_IDS[Math.floor(Math.random() * SPELL_IDS.length)], variant: 'standard', kind: 'spell' };
  }
  const odds = packOdds(packType, m);
  const allowed = RARITY_ORDER.filter(k => !minRarity || RARITY_ORDER.indexOf(k) >= RARITY_ORDER.indexOf(minRarity));
  let r = Math.random() * allowed.reduce((a, k) => a + odds[k], 0);
  let rarity: Rarity = allowed.filter(k => odds[k] > 0).pop() ?? allowed[0];
  for (const k of allowed) { if (r < odds[k]) { rarity = k; break; } r -= odds[k]; }
  const pool = HERO_IDS.filter(id => HEROES[id].rarity === rarity);
  const id = pool[Math.floor(Math.random() * pool.length)];
  const v = Math.random();
  const variant: Variant = v < m.holoChance ? 'holo' : v < m.holoChance + m.foilChance ? 'foil' : 'standard';
  return { id, variant, kind: 'hero' };
}

const isBig = (p: Pull) => p.kind === 'hero' && RARITY_ORDER.indexOf(HEROES[p.id].rarity) >= 2;

/**
 * All the cards in one pack (Lucky Rip can add a bonus card).
 * Pity: after a dry streak with nothing Epic or better, the pack's card is guaranteed Epic+.
 */
export function openPack(packType: string, m: MetaStats, save: SaveData): Pull[] {
  const pity = save.pity >= TUNING.pity.packsWithoutEpic;
  const cards = [rollCard(packType, m, pity ? 'epic' : undefined)];
  if (Math.random() < m.bonusCardChance) cards.push(rollCard(packType, m));
  save.pity = cards.some(isBig) ? 0 : save.pity + 1;
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
    if (node && !node.quest) for (let i = 0; i < rank; i++) save.mastery += node.cost[i];
  }
  save.nodes = {};
  save.combs = [];
}

/** Mastery earned from a run. mult = Harvest and Heartwood bonuses multiplied together. */
export function masteryFor(kills: number, seconds: number, bossKilled: boolean, mult: number, miniBosses = 0) {
  const t = TUNING.mastery;
  return Math.round((kills * t.perKill + seconds * t.perSec + miniBosses * t.miniBoss + (bossKilled ? t.boss : 0)) * mult);
}

// ---------- chapters and acts ----------
export const actDef = (act: number) => TUNING.chapters.acts[Math.min(act, TUNING.chapters.acts.length) - 1];
/** Chapter number inside the current act (1..perAct). */
export const chapterInAct = (save: SaveData) => save.chapter - (save.act - 1) * TUNING.chapters.perAct;
export const lastChapter = () => TUNING.chapters.perAct * TUNING.chapters.acts.length;

/** Called when the Frog King falls: next chapter, and maybe an act transition. */
export function bossBeaten(save: SaveData) {
  if (save.chapter >= lastChapter()) return; // main chapters done: keep replaying the last one
  save.chapter++;
  if (chapterInAct(save) > TUNING.chapters.perAct) save.actPending = true;
}

/** Mastery you hold plus everything spent in the tree: what an act reset turns into Heartwood. */
export function investedMastery(save: SaveData) {
  let total = save.mastery;
  for (const [id, rank] of Object.entries(save.nodes)) {
    const node = TREE.nodes[id];
    if (node && !node.quest) for (let i = 0; i < rank; i++) total += node.cost[i];
  }
  return total;
}
export const heartwoodFor = (save: SaveData) => Math.floor(investedMastery(save) / TUNING.chapters.heartwoodPer);

/** Act transition: the skill tree and Mastery reset, Heartwood is kept forever. Quests and the collection stay. */
export function beginNextAct(save: SaveData) {
  save.heartwood += heartwoodFor(save);
  save.mastery = 0;
  save.nodes = {};
  save.combs = [];
  save.act++;
  save.actPending = false;
}
