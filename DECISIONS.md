# DECISIONS

Running log of decisions. Newest first.

## 2026-11-12 (Phase 2, the real game loop, Tyler's spec)
- **Loop:** the very first run is Stinger only and ends in ~20 s. When the seed falls, a menu opens with tabs: Shop, Skill Tree, Collection (placeholder). Spend Mastery in the tree, spend gold in the shop, open packs, build a team, start the next run. Runs get longer as you upgrade.
- **Gold:** a fixed budget that refills every run. Start at 1 gold; "Deeper Pockets" adds +1 per rank. Meadow Pack = 1 gold (1 card). Booster Box = 4 packs for 3 gold (unlocked in the tree). Grove Pack = 2 gold, better odds (unlocked later, mixes into the shop).
- **Shop:** 3 random offers like Super Auto Pets. Reroll costs 1 gold; "Lucky Shopper" gives free rerolls. Packs open right away in the menu with a face-down flip (rarity glow before the flip).
- **Mastery:** earned per run = 0.5 per kill + 1 per 10 s survived + 100 for the boss. No more Nectar or mid-run shop.
- **Stinger** now hits every enemy inside its circle (Tyler). New "Wide Sting" node grows the circle.
- **Skill tree v1** (`src/data/tree.json`): Economy = Deeper Pockets, Lucky Shopper, Booster Boxes, Grove Packs. Hive = Thick Husk, Sharper Stinger, Quick Sting, Wide Sting, Harvest (+Mastery). Quest and per-hero Legends nodes come later.
- **Save:** progress (Mastery, tree, run count) saves in the browser on that device. "Reset all progress" is at the bottom of the Skill Tree tab.
- **Balance (progression bot, 10 runs):** run 1 = 22 s, run 3 = 50 s, run 9 = 76 s. Seed HP 180, spawns ramp 1.2/s to 2.5/s.

## 2026-11-12 (Phase 2, Tyler's second round of feedback)
- **No slot ring:** helpers idle at spread-out spots around the seed and all of them roam. Team cap is 6 (`maxHelpers`). Replace by tapping a helper.
- **Spiders roam too.** Orb-Weaver keeps its distance and webs from range; Trapdoor Spider walks out and lays web traps on the ground every 6 s (ground enemies crossing them get webbed).
- **No waves:** enemies spawn non-stop and ramp from 0.35/s to 1.1/s over 5 minutes, with enemy health +10% per minute and a "Swarm incoming!" surge every 60 s. New enemy types unlock over time (wasps 0:40, snails 1:30, wisps 2:20).
- **Frog King at 5:00** (greybox length; design target is ~15 min, set by `bossAtSec`). Tongue Lash stuns the nearest helper 4 s; Belly Flop hops toward the seed and splashes out 5 grubs; enraged below 50%. Killing him wins the run.
- **Balance (bots):** bots last 3:30 to 5:00 but haven't beaten the full run yet; the boss fight alone is a coin flip with 6 helpers. Bots don't replace helpers or aim well, so a human should do better. Expect to tune after Tyler plays.
- (Superseded the same day by the menu loop above.)
- `?boss` URL flag skips to the boss for testing.

## 2026-11-11 (Phase 2, step 1 rework, Tyler's feedback)
- **Top-down arena** instead of side lanes: enemies pour in from every screen edge and drift freely toward the seed. Sprites will still be drawn in side profile (Phase 5).
- **Roaming helpers:** Ant, Bee, Firefly, Bombardier, Stag Beetle and Mantis chase enemies inside the defended circle and walk home when it's clear. Melee helpers pin the enemy they fight. Orb-Weaver and Trapdoor Spider stay on their slot (stationary defenders).
- **Every run starts with one free pack containing one helper.** More packs are bought with Nectar in the shop and opened mid-run (game pauses during the reveal). 1 card per pack for now (`cardsPerPack` in tuning.json).
- **Helpers are per-run only:** they're gone when the run ends. Duplicates in a run merge into stars (2 copies = 2 stars, 4 = 3 stars). Board full = replace a helper or discard.
- **Bot balance (6 runs):** 2 of 6 bot runs win all 5 waves; the rest fall on waves 4 to 5. Pack price grows x1.25 per pack.
- Helpers can't be hurt yet. If roaming feels too safe, enemies attacking helpers is the next lever.

## 2026-11-11 (Phase 2, step 1: first battle)
- **Workflow:** each step is a branch + pull request. Tyler tests a preview link, then merges. Merging to main publishes to GitHub Pages.
- **Data-driven from day one:** heroes, enemies, waves and tuning live in `src/data/*.json` (pulled forward from Phase 4 because it costs nothing now).
- **Greybox test mode:** add `?test` to the URL to cycle helpers by clicking slots.
- **Layout:** 1280x720 landscape, scaled to fit any screen. (Lanes replaced by top-down arena, see above.)
- **Bot playtest result (5 waves):** 3 starter heroes lose on wave 5 even with the Stinger; 6 heroes win comfortably. That's the intended pressure to buy packs.

## 2026-11-11 (Tyler's review of the design doc)
- Confirmed: "Heartseed" as working title; stars last one run only; packs bought in an in-run shop and opened during the run.
- Added (Tyler's idea): quest nodes in the Mastery tree, unlocked by doing things (e.g. "pull 5 Ants", "trigger Wildfire 50 times"). Greybox gets ~5 quests; counters saved between runs.
- Added (Tyler): click attack, the "Stinger". Hold mouse to keep attacking at a steady rate (avoids spam-click fatigue). +50% on Webbed enemies. Upgraded in the Hive branch.

## 2026-11-11 (Phase 0 and Phase 1 draft)
- **Theme:** insect legends defend the Heartseed from garden predators and the Blight (option b). Tyler also considered Last Campfire, Paper Legends, Mycelium, Starfall, Lighthouse; bugs kept "for now".
- **Tech stack:** web, TypeScript + Phaser, built with Vite. Menus (binder, Mastery tree) in HTML/CSS. Hosted as a link (GitHub Pages if repo is public). Steam later via Electron + steamworks.js. Why: Claude can build and test it in the cloud, links work on phones; Godot is better for Steam but Claude can't use its editor well.
- **Platform target:** desktop landscape first. Phone (iPhone) is for viewing and check-ins only.
- **Where work happens:** Claude builds and tests in its cloud workspace; Tyler's desktop (Windows?, Ryzen 3700X, RTX 3060 Ti, 32GB) only needed for Steam builds and maybe PixelLab.
- **PixelLab:** Tyler has Tier 2 with API access. Claude may spend credits without asking but should be efficient and warn when using many generations. Not reachable yet: project network blocks api.pixellab.ai.
- **Packs open during runs** (with Nectar from kills), not only between runs. (Confirmed.)
- **Stars last one run only** (confirmed). Permanent progress = Mastery tree + variant bonuses.
- **Prototype scope:** 1 pack, 8 heroes, 3 spells, 3 combo tags (Web, Ember, Swarm), standard + foil + holo variants.
- **Design doc:** https://claude.ai/artifact/2VNXxdbTXeNYEsro3D9EG3
