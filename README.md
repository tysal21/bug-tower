# Heartseed (working title)

A browser tower-defense game: insect legends, pulled from booster packs mid-run, defend the Heartseed from garden monsters.

- Design doc: https://claude.ai/artifact/2VNXxdbTXeNYEsro3D9EG3
- Decisions log: [DECISIONS.md](DECISIONS.md)
- Plan: [ROADMAP.md](ROADMAP.md)

Tech: TypeScript + Phaser, built with Vite.

## Running it on a computer

1. Install [Node.js](https://nodejs.org) (the LTS version).
2. In a terminal inside this folder: `npm install` (first time only), then `npm run dev`.
3. Open the link it prints (usually http://localhost:5173).

## How to play

- Hold the mouse on enemies to Sting them. Webbed enemies take +50%.
- Kills drop Nectar. Press Space (or the button bottom right) to open a pack in the middle of the fight.
- Spells sit bottom left. Cast them with 1 and 2.
- When the Heartseed falls you go to the Market: spend gold on packs for your next team and Mastery on the skill tree, then press Battle.

Useful extras: add `?speed=3` to the address to run the game 3x faster, `?test` to swap helpers by clicking them, `?boss` to skip to 5 seconds before the Frog King, `?at=95` to start 95 seconds in, or `?nectar=50` to start with Nectar.

## Where things live

- `src/data/*.json` - all the game numbers (heroes, enemies, tuning incl. the spawn ramp and boss). Change balance here.
- `src/scenes/BattleScene.ts` - the battle: spawn ramp, Frog King, helpers, combos, packs, the Stinger.
- `src/game/` - small building blocks (Hero, Enemy, data types).
- `src/ui/menu.ts` - the between-runs screen (Market, brood combs, skill tree, quests, collection).
- `src/ui/reveal.ts` - the card flip, shared by the Market and by packs opened mid-run.
- `src/meta/run.ts` - the team and spells you carry for one run.
- `src/data/spells.json` - the three spells.
- `scripts/art/pixellab.py` - regenerates the sprites with PixelLab (needs a PixelLab API token and Pillow).
- `scripts/art/pixellab_ui.py`, `pixellab_bg.py` - generate UI pieces, icons, battle map and menu backdrop with PixelLab; `build_ui.py` picks the options and snaps them to the shared palette into `src/art/ui/`.
- `src/ui/treeGraph.ts` - lays the skill tree out as a honeycomb around the Heartseed.
- `src/meta/` - saving progress, skill tree effects, shop rolls.
- `src/data/shop.json`, `src/data/tree.json` - shop items, pack odds and skill tree nodes.
- `.github/workflows/deploy.yml` - publishes the game to GitHub Pages when `main` changes.
