// Progress that survives between runs, saved in the browser on this device.
const KEY = 'heartseed-save-v1';

export type Variant = 'standard' | 'foil' | 'holo';

export interface SaveData {
  mastery: number;
  nodes: Record<string, number>; // skill tree node id -> rank bought
  runs: number;
  bestTime: number;
  bossKills: number;
  pulled: string[]; // every hero you've ever pulled (feeds Legends nodes and the Collection)
  variants: Record<string, Variant[]>; // hero id -> variants you've pulled (Collection)
  spellsPulled: string[]; // every spell you've ever pulled (Collection)
  combs: number[]; // brood combs: time (ms) each one started its current egg
  counters: Record<string, number>; // quest counters, e.g. packs, wildfires, "pull:ant"
  questsDone: string[]; // quest nodes already finished (so each one is announced once)
  pity: number; // packs opened in a row with nothing Epic or better
  chapter: number; // current chapter, counted across acts (1, 2, 3 = Act I; 4, 5, 6 = Act II ...)
  act: number; // current act (1-based)
  actPending: boolean; // beat the act's last boss: the next menu must start the next act
  heartwood: number; // permanent meta-currency kept through act resets
  bestWave: number;
}

export function freshSave(): SaveData {
  return {
    mastery: 0, nodes: {}, runs: 0, bestTime: 0, bossKills: 0, pulled: [], variants: {}, spellsPulled: [], combs: [],
    counters: {}, questsDone: [], pity: 0, chapter: 1, act: 1, actPending: false, heartwood: 0, bestWave: 0,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s: SaveData = { ...freshSave(), ...JSON.parse(raw) };
      // Saves from before quests existed: carry over what we already know.
      s.counters.bossKills = Math.max(s.counters.bossKills ?? 0, s.bossKills);
      return s;
    }
  } catch { /* storage blocked: play without saving */ }
  return freshSave();
}

export function writeSave(s: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
