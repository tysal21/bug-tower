// Progression bot: plays Heartseed from a fresh save and logs every run, to check the pacing curve.
// Usage: npm run dev (in another terminal), then: node tools/bot.mjs [runs=30] [speed=4] [url=http://localhost:5173/]
// It aims the Stinger perfectly at the biggest clump near the seed and rips packs as soon as they're ready,
// so a real player will usually do a little worse in the opening seconds and a little better at choosing helpers.
import { createRequire } from 'node:module';
// Playwright isn't a project dependency: use whatever copy is installed (locally or globally).
const { chromium } = createRequire(import.meta.url)('playwright');

const RUNS = Number(process.argv[2] ?? 30);
const SPEED = Number(process.argv[3] ?? 4);
const URL = process.argv[4] ?? 'http://localhost:5173/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
await page.goto(`${URL}?speed=${SPEED}`);

// In-page helpers: Stinger aim every 30 ms, pack ripping, menu shopping.
await page.evaluate(() => {
  const w = window;
  w.__bot = { ripAt: 0, log: [] };
  setInterval(() => {
    const b = w.__battle, menu = w.__menu;
    if (!b || !menu.root.hidden || b.state !== 'playing') return;
    const p = b.input.activePointer;
    const rev = b.reveal;
    // Ripping a pack keeps your hand off the Stinger: one click per 250 ms real time.
    if (rev.active) {
      p.isDown = false;
      if (performance.now() < w.__bot.ripAt) return;
      w.__bot.ripAt = performance.now() + 250;
      if (!rev.flipped) rev.flip();
      else if (w.__pullFate(rev.loadout, rev.queue[0], b.meta) === 'full') rev.next();
      else rev.take();
      return;
    }
    if (b.sealed > 0 || b.nectar >= b.packPrice) { b.buyPack(); b.uiPress = false; w.__bot.ripAt = performance.now() + 250; return; }
    const r = 40 * b.meta.stingerRadiusMult * 0.9;
    const near = b.enemies.filter(e => e.alive && Math.hypot(e.x - 640, e.y - 360) < 300);
    let best = null, bestScore = -1;
    for (const e of near) {
      const hits = near.filter(o => Math.hypot(o.x - e.x, o.y - e.y) < r).length;
      const score = hits * 1000 - Math.hypot(e.x - 640, e.y - 360);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (!best) { p.isDown = false; return; }
    p.isDown = true; b.uiPress = false;
    p.x = p.worldX = best.x; p.y = p.worldY = best.y;
  }, 30);
});

const waitFor = async (fn, ms = 600000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(150); }
  throw new Error('timeout');
};

// The menu: act gate, then tree (cheapest of the highest-priority tier), then shop (Bundle Box, then cheapest packs).
async function shop() {
  return page.evaluate(() => {
    const menu = window.__menu, save = window.__save, rev = menu.reveal;
    const T = window.__TREE, unlocked = window.__nodeUnlocked;
    if (save.actPending) menu.startNextAct();
    const tierRank = { early: 0, core: 1, late: 2 };
    const skip = new Set(['comb', 'reroll', 'stall']); // home combs run on real time; rerolls don't help a bot
    for (let guard = 0; guard < 200; guard++) {
      const options = Object.keys(T.nodes).filter(id => {
        const n = T.nodes[id], rank = save.nodes[id] ?? 0;
        return !n.quest && !skip.has(id) && rank < n.cost.length && unlocked(save, id) && save.mastery >= n.cost[rank];
      });
      if (!options.length) break;
      options.sort((a, b) => (tierRank[T.nodes[a].tier ?? 'core'] - tierRank[T.nodes[b].tier ?? 'core']) || (T.nodes[a].cost[save.nodes[a] ?? 0] - T.nodes[b].cost[save.nodes[b] ?? 0]));
      menu.buyNode(options[0]);
    }
    const bought = [];
    const flush = () => { for (let i = 0; i < 50 && rev.active; i++) { rev.flip(); if (window.__pullFate(rev.loadout, rev.queue[0], menu.m) === 'full') rev.next(); else rev.take(); } };
    for (let guard = 0; guard < 20; guard++) {
      const items = window.__SHOP.items;
      const can = menu.offers.map((id, i) => [id, i]).filter(([id]) => id && items[id].cost <= menu.gold);
      if (!can.length) break;
      can.sort((a, b) => (items[b[0]].guaranteed ? 1 : 0) - (items[a[0]].guaranteed ? 1 : 0) || items[a[0]].cost - items[b[0]].cost);
      bought.push(can[0][0]);
      menu.buy(can[0][1]);
      flush();
    }
    const info = { bought: bought.join('+') || '-', team: menu.loadout.team.length, coins: menu.m.maxGold, nodes: Object.values(save.nodes).reduce((a, b) => a + b, 0), chapter: save.chapter, act: save.act, heartwood: save.heartwood };
    document.querySelector('[data-start]').click();
    return info;
  });
}

console.log('run | act ch | team | bought        | coins | lasted | wave | won | kills | +mastery | nodes');
let t0 = Date.now(), totalGameSec = 0;
for (let run = 1; run <= RUNS; run++) {
  let info = { bought: '(first run)', team: 0, coins: 3, nodes: 0, chapter: 1, act: 1 };
  await waitFor(() => (window.__menu && !window.__menu.root.hidden) || (window.__battle && window.__battle.state === 'playing'));
  if (await page.evaluate(() => !window.__menu.root.hidden)) info = await shop();
  await waitFor(() => window.__battle && window.__battle.state === 'playing');
  await waitFor(() => !window.__menu.root.hidden);
  const s = await page.evaluate(() => window.__menu.summary);
  totalGameSec += s.seconds + 20; // + ~20 s in the menu
  console.log(`${String(run).padStart(3)} | ${info.act}  ${String(info.chapter).padStart(2)} | ${String(info.team).padStart(4)} | ${info.bought.padEnd(13)} | ${String(info.coins).padStart(5)} | ${String(Math.floor(s.seconds / 60)).padStart(3)}:${String(s.seconds % 60).padStart(2, '0')} | ${String(s.wave).padStart(4)} | ${s.won ? 'WIN' : '   '} | ${String(s.kills).padStart(5)} | ${String(s.mastery).padStart(8)} | ${info.nodes}`);
  if (s.quests.length) console.log(`      quest done: ${s.quests.join(', ')}`);
}
console.log(`played ~${Math.round(totalGameSec / 60)} min of game time in ${Math.round((Date.now() - t0) / 60000)} min real time`);
await browser.close();
