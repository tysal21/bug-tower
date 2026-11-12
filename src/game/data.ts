// Typed access to the JSON data files. Change numbers in src/data/*.json, not here.
import heroesJson from '../data/heroes.json';
import enemiesJson from '../data/enemies.json';
import tuningJson from '../data/tuning.json';

export type Tag = 'web' | 'ember' | 'swarm' | 'none';
export type DamageType = 'physical' | 'fire';

export interface HeroDef {
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  tag: Tag;
  damageType: DamageType;
  damage: number;
  attacksPerSec: number;
  range: number;
  hitsAir: boolean;
  /** Free-moving helper that chases enemies (false = stays on its slot). */
  moves?: boolean;
  moveSpeed?: number;
  splash?: number;
  webSec?: number;
  burnSec?: number;
  burnDps?: number;
  sunderSec?: number;
  executeBelow?: number;
  trapEverySec?: number;
  trapRadius?: number;
  trapSec?: number;
}

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  armor: number;
  flying: boolean;
  physicalImmune: boolean;
  nectar: number;
  seedDps: number;
  size: number;
  boss?: boolean;
}


export const HEROES = heroesJson as Record<string, HeroDef>;
export const ENEMIES = enemiesJson as Record<string, EnemyDef>;
export const TUNING = tuningJson;
export const HERO_IDS = Object.keys(HEROES);

// Greybox colours: one colour per combo tag so you can read the board at a glance.
export const TAG_COLOR: Record<Tag, number> = {
  web: 0xe8e8f0,
  ember: 0xff8a2a,
  swarm: 0xf2c94c,
  none: 0x8a8f98,
};
