// The between-runs menu: Market (shop + brood combs) on the left, skill tree / collection on the right.
// Plain HTML over the game canvas.
import { HEROES, HERO_IDS, SPELLS, SPELL_IDS, TUNING, TAG_COLOR } from '../game/data';
import {
  SHOP, TREE, MetaStats, Pull, Rarity, metaStats, nodeUnlocked, refundAll, rollOffers, openPack, packOdds,
  syncCombs, combProgress, hatchComb, hatchMs, VARIANT_RANK, variantDamage, questDone, questProgress, bump,
} from '../meta/meta';
import type { Loadout } from '../meta/run';
import { Reveal, VARIANT_LABEL } from './reveal';
import { SaveData, Variant, writeSave, resetSave, freshSave } from '../meta/save';
import { treeLayout, hexPoints } from './treeGraph';

export interface RunSummary { seconds: number; kills: number; mastery: number; won: boolean; quests: string[] }

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pct = (n: number) => (n >= 10 ? n.toFixed(0) : n.toFixed(1)) + '%';
const TIER_LABEL = { early: 'Buy early', core: 'Core', late: 'Late game' };

export class Menu {
  root: HTMLDivElement;
  tab: 'upgrades' | 'collection' = 'upgrades';
  gold = 1;
  rerolls = 0;
  offers: (string | null)[] = [];
  loadout: Loadout = { team: [], spells: [] }; // helpers and spells for the next run
  questNews: string[] = []; // quests finished since the menu opened
  summary: RunSummary | null = null;
  selected: string | null = null; // skill tree node shown in the detail card
  timer = 0;

  constructor(private save: SaveData, private reveal: Reveal, private onStart: (loadout: Loadout) => void) {
    this.root = document.createElement('div');
    this.root.id = 'menu';
    this.root.hidden = true;
    document.body.appendChild(this.root);
  }

  get m(): MetaStats { return metaStats(this.save); }

  /** Opens the menu after a run: gold refills, team is empty, new shop. */
  open(summary: RunSummary | null) {
    const m = this.m;
    this.summary = summary;
    this.gold = m.maxGold;
    this.rerolls = m.freeRerolls;
    this.offers = rollOffers(this.save);
    this.loadout = { team: [], spells: [] };
    this.questNews = [...(summary?.quests ?? [])];
    this.root.hidden = false;
    syncCombs(this.save, m); writeSave(this.save);
    this.render();
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tickCombs(), 500);
  }

  close() { this.root.hidden = true; clearInterval(this.timer); }

  // ---------- shop ----------
  buy(slot: number) {
    const id = this.offers[slot];
    if (!id) return;
    const item = SHOP.items[id];
    if (this.gold < item.cost) return;
    this.gold -= item.cost;
    this.offers[slot] = null;
    this.openPacks(Array.from({ length: item.packs }, () => item.packType));
  }

  reroll() {
    if (this.rerolls > 0) this.rerolls--;
    else if (this.gold >= SHOP.rerollCost) this.gold -= SHOP.rerollCost;
    else return;
    this.offers = rollOffers(this.save);
    this.render();
  }

  hatch(i: number) {
    const m = this.m;
    const packs = hatchComb(this.save, i, m);
    if (!packs.length) return;
    this.openPacks(packs);
  }

  /** Opens packs one card at a time, then comes back to the Market. */
  openPacks(types: string[]) {
    const cards: Pull[] = [];
    for (const t of types) cards.push(...openPack(t, this.m, this.save));
    this.questNews.push(...bump(this.save, 'packs', types.length));
    writeSave(this.save);
    this.render();
    this.reveal.show(cards, this.loadout, () => this.m, () => {
      this.questNews.push(...this.reveal.questNews.splice(0));
      this.render();
    });
  }

  // ---------- tree ----------
  buyNode(id: string) {
    const node = TREE.nodes[id];
    const rank = this.save.nodes[id] ?? 0;
    const cost = node.cost[rank];
    if (node.quest || cost === undefined || this.save.mastery < cost || !nodeUnlocked(this.save, id)) return;
    const before = this.m;
    this.save.mastery -= cost;
    this.save.nodes[id] = rank + 1;
    const after = this.m;
    // Upgrades that touch the shop apply right away to this visit.
    this.gold += after.maxGold - before.maxGold;
    this.rerolls += after.freeRerolls - before.freeRerolls;
    while (this.offers.length < after.offerSlots) this.offers.push(rollOffers(this.save)[0]);
    syncCombs(this.save, after);
    writeSave(this.save);
    this.render();
  }

  // ---------- rendering ----------
  render() {
    const s = this.summary;
    const scroll = this.root.querySelector('.market')?.scrollTop ?? 0;
    const graphScroll = this.root.querySelector('.graph-wrap')?.scrollLeft;
    this.root.innerHTML = `
      <div class="screen">
        <header class="topbar">
          <h1>Heartseed</h1>
          ${s ? `<p class="summary">${s.won ? 'You beat the Frog King!' : 'The Heartseed fell.'} Lasted <b>${clock(s.seconds)}</b> · ${s.kills} kills · <b class="mastery">+${s.mastery} Mastery</b></p>` : '<p class="summary muted">Spend gold on packs, Mastery on upgrades, then defend the seed.</p>'}
          ${this.questNews.length ? `<p class="quest-news">📜 Quest complete: <b>${[...new Set(this.questNews)].join(', ')}</b></p>` : ''}
        </header>
        ${this.marketHtml()}
        ${this.progressHtml()}
      </div>`;
    const market = this.root.querySelector('.market');
    if (market) market.scrollTop = scroll;
    // On narrow screens the tree is wider than the panel: start it centred on the seed.
    const wrap = this.root.querySelector<HTMLElement>('.graph-wrap');
    if (wrap && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = graphScroll ?? (wrap.scrollWidth - wrap.clientWidth) / 2;
    this.bind();
  }

  currencyHtml() {
    const pips = Array.from({ length: this.m.maxGold }, (_, i) => `<span class="pip ${i < this.gold ? 'full' : ''}"></span>`).join('');
    return `<div class="purse">
      <span class="coin" title="Gold: refills to full every run">${pips}<b>${this.gold}</b></span>
      <span class="mastery" title="Mastery: earned in runs, spent in the skill tree">✦ <b>${this.save.mastery}</b></span>
    </div>`;
  }

  marketHtml() {
    const m = this.m;
    const meadowEach = SHOP.items.meadow.cost;
    const offers = this.offers.map((id, i) => {
      if (!id) return `<div class="offer sold"><span>Sold</span></div>`;
      const it = SHOP.items[id];
      const can = this.gold >= it.cost;
      const deal = it.packType === 'meadow' && it.packs > 1 ? `<span class="deal">save ${Math.round((1 - it.cost / (it.packs * meadowEach)) * 100)}%</span>` : '';
      const odds = packOdds(it.packType, m);
      return `<button class="offer ${it.packType} ${it.packs > 1 ? 'bundle' : ''}" data-buy="${i}" ${can ? '' : 'disabled'}
          title="Rare+ ${pct(100 - odds.common)} · Legendary ${pct(odds.legendary)}">
        <div class="pack-art">${it.packs > 1 ? '<i></i><i></i><i></i>' : '<i></i>'}</div>
        <div class="offer-name">${it.name}</div>
        <div class="offer-sub">${it.packs > 1 ? `${it.packs} packs` : '1 pack'}${it.packType === 'grove' ? ' · rare odds' : ''} ${deal}</div>
        <div class="offer-odds">Rare+ ${pct(100 - odds.common)}</div>
        <span class="price">${it.cost} <span class="pip full"></span></span>
      </button>`;
    }).join('');
    const rerollLabel = this.rerolls > 0 ? `↻ Reroll <small>free ×${this.rerolls}</small>` : `↻ Reroll <small>${SHOP.rerollCost} gold</small>`;
    const canReroll = this.rerolls > 0 || this.gold >= SHOP.rerollCost;
    const spells = Array.from({ length: TUNING.spells.slots }, (_, i) => {
      const sp = this.loadout.spells[i];
      if (!sp) return `<div class="chip empty spell"><span class="muted small">spell</span></div>`;
      const d = SPELLS[sp.id];
      return `<div class="chip spell" style="--tag:${hex(TAG_COLOR[d.tag])}" title="${d.name}: ${d.desc}"><span>${d.icon} ${d.name}</span><span class="stars">${'★'.repeat(sp.stars)}</span></div>`;
    }).join('');
    const team = Array.from({ length: m.maxHelpers }, (_, i) => {
      const t = this.loadout.team[i];
      if (!t) return `<div class="chip empty"></div>`;
      const d = HEROES[t.id];
      return `<div class="chip ${t.variant ?? ''} r-${d.rarity}" style="--tag:${hex(TAG_COLOR[d.tag])}" title="${d.name}${t.variant && t.variant !== 'standard' ? ' · ' + VARIANT_LABEL[t.variant] : ''}">
        <span>${d.name.split(/[ -]/)[0]}</span><span class="stars">${'★'.repeat(t.stars)}</span></div>`;
    }).join('');
    return `
      <section class="panel market">
        <div class="panel-head"><h2>Market</h2>${this.currencyHtml()}</div>
        <div class="offers" style="--slots:${Math.min(4, this.offers.length)}">${offers}</div>
        <button class="secondary reroll" data-reroll ${canReroll ? '' : 'disabled'}>${rerollLabel}</button>
        <div class="sub-head"><h3>Brood combs</h3><span class="muted small">hatch free packs, even while you're away</span></div>
        <div class="combs">${this.combsHtml(m)}</div>
        <div class="sub-head"><h3>Your team this run</h3><span class="muted small">lasts one run · duplicates add ★</span></div>
        <div class="team">${team}</div>
        <div class="team spells">${spells}</div>
        <p class="muted small nectar-note">🍯 Kills drop Nectar. Spend it on more packs in the middle of a run.</p>
      </section>`;
  }

  combsHtml(m: MetaStats) {
    if (!m.combs) {
      return `<button class="comb locked" data-goto="comb"><svg viewBox="-1 -1 2 2"><polygon points="${hexPoints(0.92)}"/></svg>
        <span class="comb-text">🔒<small>Unlock in the Brood branch</small></span></button>`;
    }
    return this.save.combs.map((_, i) => {
      const p = combProgress(this.save, i, m);
      return `<button class="comb ${p.ready ? 'ready' : ''}" data-comb="${i}" ${p.ready ? '' : 'disabled'} style="--p:${p.ratio}">
        <svg viewBox="-1 -1 2 2"><polygon class="cell" points="${hexPoints(0.92)}"/><polygon class="fill" points="${hexPoints(0.92)}"/></svg>
        <span class="comb-text"><span class="egg">${p.ready ? '🐣' : '🥚'}</span><small data-comb-time="${i}">${p.ready ? 'Hatch!' : clock(p.msLeft / 1000)}</small></span>
      </button>`;
    }).join('') + `<span class="muted small comb-note">one pack every ${clock(hatchMs(m) / 1000)}</span>`;
  }

  /** Updates comb timers in place, so the rest of the screen doesn't flicker. */
  tickCombs() {
    if (this.root.hidden) return;
    const m = this.m;
    this.save.combs.forEach((_, i) => {
      const el = this.root.querySelector<HTMLButtonElement>(`[data-comb="${i}"]`);
      if (!el) return;
      const p = combProgress(this.save, i, m);
      if (p.ready && el.disabled) { this.render(); return; }
      el.style.setProperty('--p', String(p.ratio));
      const t = el.querySelector('[data-comb-time]');
      if (t && !p.ready) t.textContent = clock(p.msLeft / 1000);
    });
  }

  progressHtml() {
    return `
      <section class="panel progress">
        <div class="panel-head">
          <nav>
            <button data-tab="upgrades" class="${this.tab === 'upgrades' ? 'on' : ''}">Upgrades</button>
            <button data-tab="collection" class="${this.tab === 'collection' ? 'on' : ''}">Collection</button>
          </nav>
          <span class="head-right">${this.tab === 'upgrades' ? '<button class="link" data-refund title="Free while costs are being tuned">Refund all</button>' : ''}<span class="mastery">✦ <b>${this.save.mastery}</b> Mastery</span></span>
        </div>
        ${this.tab === 'upgrades' ? this.treeHtml() : this.collectionHtml()}
        <footer class="progress-foot">
          ${this.tab === 'upgrades' ? this.detailHtml() : '<div></div>'}
          <button class="battle" data-start>Battle<small>${this.loadoutLabel()}</small></button>
        </footer>
      </section>`;
  }

  loadoutLabel() {
    const h = this.loadout.team.length, sp = this.loadout.spells.length;
    if (!h && !sp) return 'Stinger only';
    return [h ? `${h} helper${h > 1 ? 's' : ''}` : '', sp ? `${sp} spell${sp > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  }

  treeHtml() {
    const L = treeLayout();
    const [bx, by, bw, bh] = L.box;
    const R = 0.4;
    const rankOf = (id: string) => this.save.nodes[id] ?? 0;
    const edges = Object.values(L.nodes).map(p => {
      const from = p.parent ? L.nodes[p.parent] : { x: 0, y: 0 };
      const n = TREE.nodes[p.id];
      const color = TREE.branches[p.branch].color;
      const cls = (n.quest ? questDone(this.save, p.id) : rankOf(p.id)) ? 'lit' : nodeUnlocked(this.save, p.id) ? 'open' : 'shut';
      return `<line class="edge ${cls}" x1="${from.x}" y1="${from.y}" x2="${p.x}" y2="${p.y}" style="--c:${color}" data-for="${n.name}"/>`;
    }).join('');
    const hexR = hexPoints(R);
    const nodes = Object.values(L.nodes).map(p => {
      const n = TREE.nodes[p.id];
      if (n.quest) {
        // Quest cells fill up as you play instead of costing Mastery.
        const have = questProgress(this.save, p.id), done = questDone(this.save, p.id), w = 0.78;
        return `<g class="tnode quest ${done ? 'maxed' : ''} ${this.selected === p.id ? 'sel' : ''}" data-node="${p.id}" transform="translate(${p.x.toFixed(3)} ${p.y.toFixed(3)})" style="--c:${TREE.branches[p.branch].color}">
          <title>Quest: ${n.name}</title>
          <polygon class="halo" points="${hexPoints(R + 0.09)}"/>
          <polygon class="cell" points="${hexR}"/>
          <text class="icon" y="0.02">${done ? '✅' : n.icon}</text>
          <g class="lvl" transform="translate(0 ${R + 0.14})">
            <rect x="${-w / 2}" y="-0.11" width="${w}" height="0.22" rx="0.11"/>
            <rect class="lvl-fill" x="${-w / 2}" y="-0.11" width="${(w * have / n.quest.goal).toFixed(3)}" height="0.22" rx="0.11"/>
            <text y="0.005">${done ? 'Done' : `${have}/${n.quest.goal}`}</text>
          </g>
        </g>`;
      }
      const rank = rankOf(p.id), max = n.cost.length;
      const unlocked = nodeUnlocked(this.save, p.id);
      const hidden = !!n.hero && !unlocked; // unpulled hero: show a mystery cell
      const afford = unlocked && rank < max && this.save.mastery >= n.cost[rank];
      const cls = [rank >= max ? 'maxed' : rank ? 'owned' : '', unlocked ? '' : 'locked', afford ? 'afford' : '', this.selected === p.id ? 'sel' : ''].join(' ');
      const w = 0.66, frac = rank / max;
      return `<g class="tnode ${cls}" data-node="${p.id}" transform="translate(${p.x.toFixed(3)} ${p.y.toFixed(3)})" style="--c:${TREE.branches[p.branch].color}">
        <title>${hidden ? 'Unknown hero' : n.name}</title>
        <polygon class="halo" points="${hexPoints(R + 0.09)}"/>
        <polygon class="cell" points="${hexR}"/>
        <text class="icon" y="0.02">${hidden ? '?' : n.icon}</text>
        ${unlocked ? '' : `<text class="lock" x="0.27" y="-0.25">🔒</text>`}
        <g class="lvl" transform="translate(0 ${R + 0.14})">
          <rect x="${-w / 2}" y="-0.11" width="${w}" height="0.22" rx="0.11"/>
          <rect class="lvl-fill" x="${-w / 2}" y="-0.11" width="${(w * frac).toFixed(3)}" height="0.22" rx="0.11"/>
          <text y="0.005">${rank}/${max}</text>
        </g>
      </g>`;
    }).join('');
    const labels = L.labels.map(l => `<text class="blabel" x="${l.x}" y="${l.y}" text-anchor="${l.anchor}" fill="${l.color}">${l.name}</text>`).join('');
    return `
      <div class="graph-wrap">
        <svg class="graph" viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="xMidYMid meet">
          ${edges}${labels}
          <g class="seed" data-node="">
            <circle r="0.62"/><circle class="seed-core" r="0.44"/><text class="icon" y="0.02">🌱</text>
          </g>
          ${nodes}
        </svg>
      </div>`;
  }

  detailHtml() {
    const id = this.selected;
    if (!id) {
      return `<div class="detail intro"><b>Your Heartseed</b><span class="muted small">Upgrades grow outward from the seed. Tap a cell to see it. A cell unlocks once the one before it has a level. Glowing cells are ones you can afford.</span></div>`;
    }
    const n = TREE.nodes[id];
    const b = TREE.branches[n.branch];
    if (n.quest) {
      const have = questProgress(this.save, id), done = questDone(this.save, id);
      return `<div class="detail" style="--c:${b.color}">
        <div class="detail-top"><span class="detail-icon">${done ? '✅' : n.icon}</span>
          <div class="detail-text"><b>${n.name}</b> <span class="muted small">${n.branch} · Quest · ${have}/${n.quest.goal}</span>
            <p><b>${n.quest.task}.</b> Reward: ${n.desc}.</p></div>
          <div class="detail-act">${done ? '<span class="maxed">Reward active</span>' : '<span class="needs">Costs no Mastery. Just play.</span>'}</div>
          <button class="close" data-node="" aria-label="Close">×</button></div>
      </div>`;
    }
    const rank = this.save.nodes[id] ?? 0, max = n.cost.length;
    const unlocked = nodeUnlocked(this.save, id);
    const cost = n.cost[rank];
    const hidden = !!n.hero && !unlocked;
    let action: string;
    if (rank >= max) action = `<span class="maxed">Maxed</span>`;
    else if (!unlocked) action = `<span class="needs">🔒 ${n.hero ? 'Pull this hero from a pack to unlock' : `Needs ${TREE.nodes[n.parent!].name} first`}</span>`;
    else action = `<button data-buy-node="${id}" ${this.save.mastery >= cost ? '' : 'disabled'}>Level up · ✦ ${cost}</button>`;
    return `<div class="detail" style="--c:${b.color}">
      <div class="detail-top"><span class="detail-icon">${hidden ? '?' : n.icon}</span>
        <div class="detail-text"><b>${hidden ? 'Unknown hero' : n.name}</b> <span class="muted small">${n.branch} · ${TIER_LABEL[n.tier ?? 'core']} · Level ${rank}/${max}</span>
          <p>${hidden ? 'Someone new is out there. Pull them to start levelling them up.' : n.desc}${n.hero && !hidden ? ' per level' : ''}</p></div>
        <div class="detail-act">${action}</div>
        <button class="close" data-node="" aria-label="Close">×</button></div>
    </div>`;
  }

  collectionHtml() {
    const m = this.m;
    const order: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
    const heroes = [...HERO_IDS].sort((a, b) => order.indexOf(HEROES[a].rarity) - order.indexOf(HEROES[b].rarity));
    const got = this.save.pulled.length;
    const variantsGot = Object.values(this.save.variants).reduce((a, v) => a + v.length, 0);
    const cards = heroes.map(id => {
      const d = HEROES[id];
      const have = this.save.pulled.includes(id);
      const vs = this.save.variants[id] ?? (have ? ['standard'] : []);
      const best = vs.reduce<Variant>((a, v) => (VARIANT_RANK[v] > VARIANT_RANK[a] ? v : a), 'standard');
      const dots = (['standard', 'foil', 'holo'] as Variant[]).map(v => `<span class="vdot ${v} ${vs.includes(v) ? 'have' : ''}" title="${VARIANT_LABEL[v]}${vs.includes(v) ? '' : ' (not yet)'}"></span>`).join('');
      if (!have) return `<div class="ccard unknown r-${d.rarity}"><span class="q">?</span><span class="small muted">${d.rarity}</span><div class="vdots">${dots}</div></div>`;
      return `<div class="ccard r-${d.rarity} ${best}" style="--tag:${hex(TAG_COLOR[d.tag])}">
        <b>${d.name}</b><span class="small">${d.rarity}${d.tag === 'none' ? '' : ' · ' + d.tag}</span><div class="vdots">${dots}</div></div>`;
    }).join('');
    const row = (name: string, type: string) => {
      const o = packOdds(type, m);
      return `<tr><th>${name}</th>${order.map(r => `<td>${pct(o[r])}</td>`).join('')}</tr>`;
    };
    return `
      <div class="collection">
        <p class="muted small">${got}/${HERO_IDS.length} heroes · ${variantsGot}/${HERO_IDS.length * 3} variants. Foil and Holo copies hit harder (+${variantDamage('foil') * 100}% / +${variantDamage('holo') * 100}% damage).</p>
        <div class="ccards">${cards}</div>
        <h3>Spells</h3>
        <div class="ccards">${SPELL_IDS.map(id => {
          const d = SPELLS[id];
          return this.save.spellsPulled.includes(id)
            ? `<div class="ccard spell" style="--tag:${hex(TAG_COLOR[d.tag])}"><span class="spell-icon">${d.icon}</span><b>${d.name}</b><span class="small">${d.desc}</span></div>`
            : `<div class="ccard unknown spell"><span class="q">?</span><span class="small muted">spell</span></div>`;
        }).join('')}</div>
        <h3>Your pull odds</h3>
        <table class="odds"><tr><th></th>${order.map(r => `<th class="r-${r}">${r}</th>`).join('')}</tr>
          ${row('Meadow', 'meadow')}${row('Grove', 'grove')}</table>
        <p class="muted small">Any card: Foil ${pct(m.foilChance * 100)} · Holo ${pct(m.holoChance * 100)} · bonus card ${pct(m.bonusCardChance * 100)}. Raise these in the Fortune branch. About 1 card in ${Math.round(1 / TUNING.spells.chancePerCard)} is a spell. After ${TUNING.pity.packsWithoutEpic} packs with nothing Epic or better, the next one is guaranteed (you're at ${Math.min(this.save.pity, TUNING.pity.packsWithoutEpic)}).</p>
        <button class="link" data-reset>Reset all progress</button>
      </div>`;
  }

  bind() {
    const q = <T extends Element>(sel: string) => Array.from(this.root.querySelectorAll<T & HTMLElement>(sel));
    q<HTMLButtonElement>('[data-tab]').forEach(b => b.onclick = () => { this.tab = b.dataset.tab as Menu['tab']; this.render(); });
    q<HTMLButtonElement>('[data-buy]').forEach(b => b.onclick = () => this.buy(Number(b.dataset.buy)));
    q<HTMLButtonElement>('[data-reroll]').forEach(b => b.onclick = () => this.reroll());
    q<HTMLButtonElement>('[data-comb]').forEach(b => b.onclick = () => this.hatch(Number(b.dataset.comb)));
    q<HTMLElement>('[data-node]').forEach(b => b.onclick = () => { this.selected = b.dataset.node || null; this.render(); });
    q<HTMLButtonElement>('[data-goto]').forEach(b => b.onclick = () => { this.tab = 'upgrades'; this.selected = b.dataset.goto!; this.render(); });
    q<HTMLButtonElement>('[data-buy-node]').forEach(b => b.onclick = () => this.buyNode(b.dataset.buyNode!));
    q<HTMLButtonElement>('[data-start]').forEach(b => b.onclick = () => { this.close(); this.onStart(this.loadout); });
    q<HTMLButtonElement>('[data-refund]').forEach(b => b.onclick = () => {
      const before = this.m;
      refundAll(this.save); writeSave(this.save);
      const after = this.m;
      this.gold = Math.max(0, this.gold - (before.maxGold - after.maxGold));
      this.rerolls = Math.max(0, this.rerolls - (before.freeRerolls - after.freeRerolls));
      this.offers.length = Math.min(this.offers.length, after.offerSlots);
      this.render();
    });
    q<HTMLButtonElement>('[data-reset]').forEach(b => b.onclick = () => {
      if (b.dataset.armed) { resetSave(); Object.assign(this.save, freshSave()); this.selected = null; this.open(null); return; }
      b.dataset.armed = '1'; b.textContent = 'Tap again to erase everything';
    });
  }
}
