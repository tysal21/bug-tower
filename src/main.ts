import Phaser from 'phaser';
import { BattleScene, W, H, RunResult } from './scenes/BattleScene';
import { Menu } from './ui/menu';
import { Reveal } from './ui/reveal';
import { loadSave, writeSave } from './meta/save';
import { metaStats, masteryFor } from './meta/meta';
import type { Loadout } from './meta/run';
import { installUiCss } from './art/ui';

installUiCss();

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
// Wait for the pixel font so Phaser's canvas text doesn't draw in a fallback font.
const fontsReady = Promise.race([
  Promise.all(['400', '700'].map(w => document.fonts.load(`${w} 16px "Pixelify Sans"`))),
  new Promise(r => setTimeout(r, 2500)),
]);
game.events.once('ready', () => fontsReady.then(() => {
  if (save.runs === 0) startRun({ team: [], spells: [] });
  else menu.open(null);
}));
