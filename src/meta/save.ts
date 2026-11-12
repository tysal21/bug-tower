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
  combs: number[]; // brood combs: time (ms) each one started its current egg
}

export function freshSave(): SaveData {
  return { mastery: 0, nodes: {}, runs: 0, bestTime: 0, bossKills: 0, pulled: [], variants: {}, combs: [] };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...freshSave(), ...JSON.parse(raw) };
  } catch { /* storage blocked: play without saving */ }
  return freshSave();
}

export function writeSave(s: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
