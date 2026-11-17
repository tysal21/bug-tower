import Phaser from 'phaser';
import { BattleScene, W, H, RunResult } from './scenes/BattleScene';
import { Menu } from './ui/menu';
import { Reveal } from './ui/reveal';
import { loadSave, writeSave } from './meta/save';
import { metaStats, masteryFor } from './meta/meta';
import type { Loadout } from './meta/run';

const save = loadSave();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#14110f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
});
game.scene.add('battle', BattleScene, false);

// One card-reveal overlay shared by the Market and by packs opened mid-run.
const reveal = new Reveal(save);

function startRun(loadout: Loadout) {
  game.scene.start('battle', { loadout, meta: metaStats(save), save, reveal, onEnd: endRun });
}

function endRun(r: RunResult) {
  const mastery = masteryFor(r.kills, r.seconds, r.won, metaStats(save).masteryMult, r.miniBosses);
  save.mastery += mastery;
  save.runs++;
  save.bestTime = Math.max(save.bestTime, r.seconds);
  if (r.won) save.bossKills++;
  writeSave(save);
  game.scene.pause('battle');
  menu.open({ ...r, mastery });
}

const menu = new Menu(save, reveal, startRun);
(window as unknown as { __menu: Menu; __save: typeof save }).__menu = menu;
(window as unknown as { __save: typeof save }).__save = save;

// The very first run starts straight away with only the Stinger. After that, start at the menu.
game.events.once('ready', () => {
  if (save.runs === 0) startRun({ team: [], spells: [] });
  else menu.open(null);
});
