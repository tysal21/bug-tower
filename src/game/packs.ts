import { HEROES, HERO_IDS, HeroDef, TUNING } from './data';

type Rarity = HeroDef['rarity'];

/** Rolls a rarity using the odds in tuning.json, then a random hero of that rarity. */
export function rollHero(rand = Math.random): string {
  const odds = TUNING.packs.rarityOdds as Record<Rarity, number>;
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let r = rand() * total;
  let rarity: Rarity = 'common';
  for (const [k, v] of Object.entries(odds) as [Rarity, number][]) {
    if (r < v) { rarity = k; break; }
    r -= v;
  }
  const pool = HERO_IDS.filter(id => HEROES[id].rarity === rarity);
  return pool[Math.floor(rand() * pool.length)];
}

/** Price of the nth pack bought this run (0 = first paid pack). */
export function packPrice(n: number): number {
  const p = TUNING.packs;
  return Math.round(p.firstPrice * Math.pow(p.priceGrowth, n));
}

/** Star level from how many copies of a hero you've pulled this run. */
export function starsFor(copies: number): number {
  const steps = TUNING.copiesForStar;
  let stars = 0;
  steps.forEach((need, i) => { if (copies >= need) stars = i + 1; });
  return stars;
}
