# DECISIONS

Running log of decisions. Newest first.

## 2026-11-17 (Act resets, chapters, Elder Pack, restart button: follow-up to PR #6)
Builds the parts of Tyler's progression curve that PR #6 left out, and the restart button Tyler asked for.

- **Chapters:** each Frog King win moves you to the next chapter. Inside an act, each chapter gives enemies (boss too) +50% health and +20% spawn rate. The top bar and the Battle button show "Act I · Chapter 2".
- **Act soft resets:** 3 chapters per act, 3 acts (9 main chapters). Beating an act's last boss opens a gate in the Market: the skill tree and Mastery reset, and you keep **Heartwood**, 1 per 200 Mastery you had invested (held + spent). Each Heartwood is +2% Mastery from runs, forever. Quests, the collection, Frog King wins and pack unlocks stay.
- **Act mechanics:** Act II enemies take 20% less physical damage (Blight-hardened shells) and have 1.6x health. Act III adds 20% faster enemies, 2.4x health. Shown as a banner at the start of each run. All in `tuning.json` > `chapters`.
- **Elder Pack:** 9 coins, Epic or Legendary only, unlocks after 2 Frog King wins. This is the 5 to 10+ coin tier, next to the 6-coin Grove Pack.
- **Cheap packs always on offer:** a fresh shop always holds at least 2 Meadow Packs (`minCheap`), so pricey packs never crowd out the cheap bodies the curve says should win early.
- **Wave counter:** the HUD and run summary show the wave (one per surge).
- **Restart progress** (Tyler): a button in the top bar. Tap once to arm it (it turns red), tap again within 4 s to wipe the save and drop straight into the very first run. The old "Reset all progress" link in Collection does the same now.
- **Mastery slowed** (perKill 1.25 to 0.6, Frog King 250 to 120). With PR #6's rates the bot maxed the whole tree before Act I ended (12 runs), which leaves Act II nothing to rebuild toward and makes the game much shorter than 4 to 7 hours. Early runs still buy several nodes each. Revert these two numbers if early momentum feels too slow.
- **Progression bot** saved: `npm run dev`, then `npm run bot -- 50 5 http://localhost:5173/` (runs, game speed, address). It aims the Stinger perfectly, rips packs instantly, buys the cheapest glowing cell and the cheapest packs.

**Bot playtest (50 runs):** run 1 = 9 s, runs 2 to 4 = 0:50 to 2:00, runs 5 to 11 = 2 to 3 min, first Frog King on run 13 (4:30). Act I done in 18 runs, about 65 minutes of game time. Act II restarts at 20 s runs and climbs back to a boss kill in 15 runs. Chapter-clearing runs are 4:20 to 4:45. The bot then stalled on chapter 6 (16 runs, 2 to 4.5 min each) with the tree maxed, because it never buys Grove or Elder Packs or swaps helpers. A person who uses the bigger packs should get through. That puts Acts I to III in the 4 to 7 hour range, but it needs real play to confirm.

**Open questions:**
- The whole tree still maxes out late in each act. A second tree (spending Heartwood) or more nodes per act would give late Acts something to chase.
- Brood combs (real-time packs between runs) now overlap with the in-run Hatchery.

## 2026-11-17 (Target progression curve, Tyler's spec)
Tyler's target: a tight, fast "lose, upgrade, push slightly further" roguelite-incremental. Brisk and focused, about 4 to 7 hours for the main chapters, not a months-long idle grind.

**The curve (Tyler):**
- **First run: seconds.** Stinger only, the first enemies overwhelm the seed almost at once. The forced loss opens the upgrade loop.
- **Early runs: 30 s to about 2 min.** One stat bump and a starter unit, a few waves cleared, a trickle of Mastery, then knocked out by the first tougher enemies.
- **Chapter-clearing runs: 3 to 5+ min.** Passive generation and synergies online, an army built mid-fight, the stage boss beaten.
- **Shop:** 3 coins per visit. A basic pack costs 2, so the first visit buys 1 pack. Opening 2 packs completes an intro quest worth +1 coin (4 coins = 2 packs a visit). At 5 coins per visit the bundle box unlocks: 3 packs plus bonus currency for 5 coins (vs 6 for three singles). Budget grows through objectives, not enemy drops.
- **Speed:** almost every early run buys several skill tree nodes and visibly pushes the next run further.
- **Mid-run snowball:** tree structures generate packs during combat; the bottleneck becomes how fast you can rip packs before the wave lands.
- **Tiered unlocks:** beating a chapter boss unlocks higher-tier packs (5 to 10+ coins) with stronger pools. Three cheap packs should beat one expensive pack early.
- **Act soft resets:** every few chapters, the main tree resets in exchange for permanent meta-currency, and you rebuild against tougher enemy mechanics.

**What changed in the greybox to match:**
- Gold is now **coins**: 3 per visit (`startCoins`), Meadow Pack 2 coins, reroll 1.
- New quest cell **First Rips** (open 2 packs: +1 coin). It pays out on the same visit. Deeper Pockets still adds +1 coin per level; Pack Rat (40 packs) another +1.
- **Meadow Box**: 3 packs + 5 Nectar for the next run, 5 coins. Appears once you earn 5 coins a visit. The "Booster Boxes" tree node is gone.
- **Grove Pack**: 6 coins, better odds, appears after your first Frog King kill. The "Grove Packs" tree node is gone.
- **Hatchery** (new Brood root): during a run a free sealed pack arrives every 45 / 35 / 25 s. **Big Clutch**: start each run with sealed packs. Space opens sealed packs first, then buys with Nectar.
- **Packs no longer pause the fight.** While you flip a card the battle runs at 30% speed behind a see-through backdrop (`revealTimeScale`), so ripping fast matters. This replaces the full pause from 2026-11-16.
- **First run is a forced quick loss:** the seed has 55 HP on run 1 only (140 after), and every run opens with 6 grubs burrowing up near the seed.
- **Faster progress:** Mastery = 1.25 per kill + 0.3 per second + 12 per Toad Brute + 250 for the Frog King (all in tuning.json). Thick Husk is +25% per level. Helper damage +40% across the board. Spawns start gentler (0.8/s) and end harder (2.8/s).
- **Chapter length:** Frog King at 4:00 (was 5:00), Toad Brutes at 1:20 and 2:40, so a clearing run is about 4 to 5 minutes. This supersedes the design doc's 15-minute, 12-wave chapter.

**Bot playtest (12 runs, buys the cheapest glowing cells; a human should do better):** run 1 = 9 s (Stinger only), run 2 = 67 s, runs 3 to 5 = 1:18 to 1:34, runs 6 to 12 = about 2 to 3 min with the first Toad Brute down. Every run after the first bought 3 to 11 nodes. Coins went 3, 4, 6, 7, 8. Mid-run packs went from 4 to 15 per run once the Hatchery was bought. The bot never beat the Frog King in 12 runs, which fits a 4 to 7 hour game but is worth checking with real play.
- **Early pack safety:** while your team is empty, a pack's main card is always a helper (a spell as your only card made run 2 as short as run 1).

**Conflicts and pushback:**
- **Act soft resets are not built.** There is only one chapter, so a reset would wipe the tree and send you back into the same Frog King fight. Recommendation: build it with chapter 2, once there is something new to rebuild against. It also needs a decision on what the permanent currency buys. (Built in the follow-up above.)
- **Higher-tier packs costing 5 to 10+ coins:** only one higher tier exists (Grove, 6 coins). More tiers come with more chapters.
- **Brood combs** (real-time packs between runs) stay alongside the new in-run Hatchery. They are a second, slower source and could be cut if two pack generators feel like too much.

## 2026-11-17 (PixelLab UI, map and icons, same PR as the sprites)
- **One shared "Heartseed" palette** (24 colours: bark, moss, honey-gold, cream, berry, blight purple, rare blue, spell teal). Every UI piece is generated on it and then snapped to it exactly (`scripts/art/build_ui.py`), so menus, HUD and sprites look like one hand-made set.
- **UI pieces** (PixelLab Generate UI, 4 options each, best one picked in `PICKS`): bark panel frame, inset slot, detail box, gold / moss / battle buttons, tab, 5 skill-tree cells (locked, open, owned, quest, seed), card back, 4 rarity card frames, health and boss bar frames, spell slot. Used as CSS 9-slice `border-image` in the menus and Phaser nine-slices in battle. Hover / pressed states are brightness and a 2 px press instead of extra generations, so they always match.
- **43 icons** (pixflux, 1 generation each) replace every emoji: all skill tree nodes, spells, gold, Mastery, Nectar, Foil, Holo, lock, quest scroll. Legends cells and cards show the hero sprite.
- **Battle map:** a PixelLab forest-floor clearing (320x180, drawn 4x), dimmed and desaturated so units stay readable. **Menu backdrop:** dark bark texture.
- **Pixel font:** Pixelify Sans (open font, bundled from npm) for menus and the battle HUD.
- Cost: about 254 generations (UI pieces are 10 each). Plan had 4,242 left afterwards.
- Screens: `heartseed/art/menu-pixellab-ui.png`, `battle-pixellab-map.png`, `card-pixellab.png`.

## 2026-11-17 (PixelLab art, PR on top of #4)
- **All 17 sprites now come from PixelLab** (pixflux for the pose, animate-with-text v3 for the second frame). Same file names and 2-frame strips as the hand-drawn set; frames are about 2x bigger and drawn at 1x, so on-screen size is about the same with much more detail.
- Generator: `scripts/art/pixellab.py` (prompts, sizes and frame picks in one table). Raw outputs cached in `scripts/art/pixellab/`, so reruns only spend generations on sprites you delete or `--force`. Cost about 2 generations per sprite; 42 used in total.
- Redone once: Stag Beetle (first try had deer antlers), Blightgrub, Ironshell Snail (shell wasn't metal), Toad Brute (was facing the camera). Wasp and Stag are mirrored because PixelLab drew them facing left.
- Sheet and screenshot: `heartseed/art/sprite-sheet-pixellab.png`, `in-game-pixellab.png`.

## 2026-11-17 (Pixel art v1, PR #4)
- **Hand-made art first:** PixelLab is still blocked from cloud threads (api.pixellab.ai refused by the network). Tyler set up an environment on 2026-11-17; it only applies to threads started after it, and needs the API key as an environment variable.
- 17 sprites drawn in code (`scripts/art/`, `npm run art`), 2 frames each, side profile facing right, one shared palette, shown at 2x with crisp pixels. Units flip to face where they walk. Missing sprites fall back to greybox shapes.
- PixelLab art can replace `src/art/<name>.png` later (2-frame horizontal strip; frame size in `src/art/index.ts`).
- Sheet and screenshot: `heartseed/art/`.

## 2026-11-16 (Phase 2 step 3: spells, quests, Nectar packs, mini-boss)
- **Packs open during the run again (Tyler's original ask, confirmed 2026-11-16).** Kills drop Nectar (1 each). The "Open a pack" button (or Space) spends it on a Meadow Pack mid-fight; the game pauses while you flip the card. Price starts at 5 and grows x1.5 per pack that run (5, 8, 11, 17, 25...). The gold Market between runs stays: gold builds your starting team, Nectar grows it mid-run. `nectar.enabled` in tuning.json turns it off.
- **Spells:** Silk Storm (web everything 5 s), Rain of Embers (burn everything, ignites up to 3 webs into Wildfire), Rally Pheromone (Swarm helpers and the Stinger +50% speed for 8 s; Stinger added so the card is never dead). About 1 card in 6 is a spell. 2 spell slots, keys 1 and 2 or click. Duplicates add stars (longer effect, faster recharge). Spells last one run, like helpers.
- **Quest cells (5)** sit in the honeycomb with a gold dashed border and fill up as you play; they cost no Mastery and the reward switches on by itself. Pack Rat (open 40 packs: +1 gold), Ant Colony (pull 8 Ants: Ants arrive at 2 stars), Firestarter (75 Wildfires: +30% Wildfire reach), Web Hunter (Sting 200 Webbed enemies: Stinger +25% more vs Webbed), Kingslayer (beat the Frog King: +1 helper slot). Counters live in the save (`counters`). Goals were raised after a bot finished three of them in 14 runs.
- **Toad Brute mini-boss** at 1:40 and 3:20: swallows a nearby Blightgrub to heal 15%. Worth +5 Mastery and 15 Nectar.
- **Pity:** after 20 packs in a row with nothing Epic or better, the next card is Epic+. (The doc said 8 packs of 3 cards; packs hold 1 card now, so 8 made Epics far too common in testing.)
- **New tree nodes:** Sweet Tooth (Economy, +25% Nectar), Quick Chant (Hive, spells recharge faster).
- **One shared card reveal** (`src/ui/reveal.ts`) is used by the Market and by mid-run packs, so Phase 3's pack-ripping polish only has to be built once.
- **Bot playtest (14 runs, buys the cheapest glowing cell):** run 1 = 20 s, runs 6 to 10 = 40 to 60 s, run 14 = 68 s. 2 to 5 mid-run packs per run once runs pass 30 s. Nobody has reached a Toad Brute yet without help, so the mini-boss and Frog King are only tested with the `?at=` / `?boss` shortcuts.
- **Not built (still on the cut list):** tear-to-open packs (Phase 3), enemies hurting helpers, helper health.

## 2026-11-12 (Between-runs screen redesign, from Tyler's layout reference)
- Two-panel screen: Market on the left (gold + Mastery top-right, priced pack slots, reroll, brood combs, team), skill tree on the right with Upgrades / Collection tabs and a big Battle button bottom-right.
- Skill tree is a honeycomb graph growing out of the Heartseed: six branches (Economy, Brood, Fortune, Helpers, Legends, Hive). Each cell shows level x/y, a lock until its parent has a level, and glows when affordable.
- New Brood branch: combs hatch a free pack every 4 minutes of real time (even while away). Upgrades: faster hatch, more combs, twin eggs, Royal Jelly (Grove packs).
- New Fortune branch: Lucky Rip, Sweet Nectar (rarer pulls), Golden Hour (legendaries), Gilded Wings (Foil), Prismatic Shell (Holo).
- Foil (+20% damage) and Holo (+45%) variants now roll on every card. Base 5% / 1%.
- Collection tab: every hero (unknown ones as "?") with the variants you own, plus your current pull odds.
- Harvest moved from Hive to Economy. Common Folk now needs Kinship first.

## 2026-11-12 (Skill tree v2, from Tyler's two meta-progression guides)
- **Targeted over generic:** new **Helpers** branch upgrades the roster: Kinship (all helpers attack speed), Common Folk (common helpers damage), Web / Ember / Swarm Lore (one per combo tag), Keen Mandibles (crits), Ricochet (ranged shots bounce), Marked Prey (bosses take more damage).
- **Grows with the collection:** **Legends** branch has one node per hero (+20% damage per rank), and a hero's node only appears once you've pulled it. Flagged in-game as a specialist pick, because of the randomness trap: early Mastery is safer in versatile nodes.
- **Priority order (Tyler's roadmap):** every node is tagged Buy early / Core / Late game and sorted that way. Early = Deeper Pockets, Lucky Rip (bonus card chance), Thick Husk, Kinship, Sharper Stinger, Common Folk.
- **New Hive nodes:** Sap Flow (seed heals per kill), Regrowth (seed regenerates).
- **Free "Refund all Mastery"** while costs are still being tuned (per the guide's note that layouts and costs change pre-release).
- **Not yet:** spell cooldown nodes (no spells yet), gold interest between runs (late luxury), helper health (helpers can't be hurt yet), quest nodes.
- Save now tracks every hero pulled (`pulled`), which will also feed the Collection.

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
