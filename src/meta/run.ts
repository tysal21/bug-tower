// The team and spells you carry for one run. Built in the Market, added to by packs opened mid-run.
import { TUNING } from '../game/data';
import { MetaStats, Pull, VARIANT_RANK } from './meta';
import type { Variant } from './save';

export interface TeamMember { id: string; copies: number; stars: number; variant?: Variant }
export interface SpellSlot { id: string; copies: number; stars: number }
export interface Loadout { team: TeamMember[]; spells: SpellSlot[] }

export function starsFor(copies: number) {
  let stars = 0;
  TUNING.copiesForStar.forEach((need, i) => { if (copies >= need) stars = i + 1; });
  return stars;
}

/** What would happen if this card joined the loadout. */
export function pullFate(l: Loadout, pull: Pull, m: MetaStats): 'merge' | 'new' | 'full' {
  if (pull.kind === 'spell') {
    if (l.spells.some(s => s.id === pull.id)) return 'merge';
    return l.spells.length < TUNING.spells.slots ? 'new' : 'full';
  }
  if (l.team.some(t => t.id === pull.id)) return 'merge';
  return l.team.length < m.maxHelpers ? 'new' : 'full';
}

/** Adds a pulled card: duplicates merge into stars, otherwise it takes a free slot or replaces replaceIndex. */
export function addPull(l: Loadout, pull: Pull, m: MetaStats, replaceIndex?: number) {
  if (pull.kind === 'spell') {
    const owned = l.spells.find(s => s.id === pull.id);
    if (owned) { owned.copies++; owned.stars = starsFor(owned.copies); return; }
    const slot: SpellSlot = { id: pull.id, copies: 1, stars: 1 };
    if (replaceIndex !== undefined) l.spells[replaceIndex] = slot;
    else if (l.spells.length < TUNING.spells.slots) l.spells.push(slot);
    return;
  }
  const owned = l.team.find(t => t.id === pull.id);
  if (owned) {
    owned.copies++; owned.stars = starsFor(owned.copies);
    if (VARIANT_RANK[pull.variant] > VARIANT_RANK[owned.variant ?? 'standard']) owned.variant = pull.variant;
    return;
  }
  // Ant Colony quest reward: Ants arrive with a second copy already merged in.
  const copies = pull.id === 'ant' && m.antStart ? 2 : 1;
  const member: TeamMember = { id: pull.id, copies, stars: starsFor(copies), variant: pull.variant };
  if (replaceIndex !== undefined) l.team[replaceIndex] = member;
  else if (l.team.length < m.maxHelpers) l.team.push(member);
}
