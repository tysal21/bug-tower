# DECISIONS

Running log of decisions. Newest first.

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
