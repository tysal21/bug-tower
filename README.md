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

Useful extras: add `?speed=3` to the address to run the game 3x faster, `?test` to swap helpers by clicking them, or `?boss` to skip to 5 seconds before the Frog King.

## Where things live

- `src/data/*.json` - all the game numbers (heroes, enemies, tuning incl. the spawn ramp and boss). Change balance here.
- `src/scenes/BattleScene.ts` - the battle: spawn ramp, Frog King, helpers, combos, packs, the Stinger.
- `src/game/` - small building blocks (Hero, Enemy, data types).
- `src/ui/menu.ts` - the between-runs menu (shop, skill tree, pack reveal).
- `src/meta/` - saving progress, skill tree effects, shop rolls.
- `src/data/shop.json`, `src/data/tree.json` - shop items, pack odds and skill tree nodes.
- `.github/workflows/deploy.yml` - publishes the game to GitHub Pages when `main` changes.
