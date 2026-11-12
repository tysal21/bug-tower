// The between-runs menu: Shop, Skill Tree and (later) Collection. Plain HTML over the game canvas.
import { HEROES, TUNING, TAG_COLOR } from '../game/data';
import { SHOP, TREE, metaStats, nodeUnlocked, nodeVisible, refundAll, rollCard, rollOffers } from '../meta/meta';
import { SaveData, writeSave, resetSave, freshSave } from '../meta/save';
import type { TeamMember } from '../scenes/BattleScene';

export interface RunSummary { seconds: number; kills: number; mastery: number; won: boolean }

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function starsFor(copies: number) {
  let stars = 0;
  TUNING.copiesForStar.forEach((need, i) => { if (copies >= need) stars = i + 1; });
  return stars;
}

export class Menu {
  root: HTMLDivElement;
  tab: 'shop' | 'tree' | 'collection' = 'shop';
  gold = 1;
  rerolls = 0;
  offers: (string | null)[] = [];
  team: TeamMember[] = [];
  queue: string[] = []; // cards waiting to be revealed
  summary: RunSummary | null = null;

  constructor(private save: SaveData, private onStart: (team: TeamMember[]) => void) {
    this.root = document.createElement('div');
    this.root.id = 'menu';
    this.root.hidden = true;
    document.body.appendChild(this.root);
  }

  /** Opens the menu after a run: gold refills, team is empty, new shop. */
  open(summary: RunSummary | null) {
    const m = metaStats(this.save);
    this.summary = summary;
    this.gold = m.maxGold;
    this.rerolls = m.freeRerolls;
    this.offers = rollOffers(this.save);
    this.team = [];
    this.tab = 'shop';
    this.root.hidden = false;
    this.render();
  }

  close() { this.root.hidden = true; }

  // ---------- shop ----------
  buy(slot: number) {
    const id = this.offers[slot];
    if (!id) return;
    const item = SHOP.items[id];
    if (this.gold < item.cost) return;
    this.gold -= item.cost;
    this.offers[slot] = null;
    const bonus = metaStats(this.save).bonusCardChance;
    for (let i = 0; i < item.packs; i++) {
      this.queue.push(rollCard(item.packType));
      if (Math.random() < bonus) this.queue.push(rollCard(item.packType)); // Lucky Rip
    }
    this.render();
  }

  reroll() {
    if (this.rerolls > 0) this.rerolls--;
    else if (this.gold >= SHOP.rerollCost) this.gold -= SHOP.rerollCost;
    else return;
    this.offers = rollOffers(this.save);
    this.render();
  }

  addToTeam(id: string, replaceIndex?: number) {
    const owned = this.team.find(t => t.id === id);
    if (owned) { owned.copies++; owned.stars = starsFor(owned.copies); }
    else if (replaceIndex !== undefined) this.team[replaceIndex] = { id, copies: 1, stars: 1 };
    else if (this.team.length < TUNING.maxHelpers) this.team.push({ id, copies: 1, stars: 1 });
    this.queue.shift();
    this.render();
  }

  // ---------- tree ----------
  buyNode(id: string) {
    const node = TREE.nodes[id];
    const rank = this.save.nodes[id] ?? 0;
    const cost = node.cost[rank];
    if (cost === undefined || this.save.mastery < cost || !nodeUnlocked(this.save, id)) return;
    this.save.mastery -= cost;
    this.save.nodes[id] = rank + 1;
    writeSave(this.save);
    // Gold and reroll upgrades apply right away to this shop visit.
    if (node.effect.maxGold) this.gold += node.effect.maxGold;
    if (node.effect.freeRerolls) this.rerolls += node.effect.freeRerolls;
    this.render();
  }

  // ---------- rendering ----------
  render() {
    const s = this.summary;
    const m = metaStats(this.save);
    this.root.innerHTML = `
      <div class="menu-inner">
        <header>
          <h1>Heartseed</h1>
          ${s ? `<p class="summary">${s.won ? 'You beat the Frog King!' : 'The Heartseed fell.'} Lasted <b>${clock(s.seconds)}</b> · ${s.kills} kills · <b>+${s.mastery} Mastery</b></p>` : ''}
        </header>
        <nav>
          <button data-tab="shop" class="${this.tab === 'shop' ? 'on' : ''}">Shop</button>
          <button data-tab="tree" class="${this.tab === 'tree' ? 'on' : ''}">Skill Tree</button>
          <button data-tab="collection" class="${this.tab === 'collection' ? 'on' : ''}">Collection</button>
        </nav>
        ${this.tab === 'shop' ? this.shopHtml(m.maxGold) : this.tab === 'tree' ? this.treeHtml() : this.collectionHtml()}
      </div>
      ${this.queue.length ? this.revealHtml() : ''}`;
    this.bind();
  }

  shopHtml(maxGold: number) {
    const pips = Array.from({ length: maxGold }, (_, i) => `<span class="pip ${i < this.gold ? 'full' : ''}"></span>`).join('');
    const offers = this.offers.map((id, i) => {
      if (!id) return `<div class="offer sold">Sold</div>`;
      const it = SHOP.items[id];
      const can = this.gold >= it.cost;
      return `<div class="offer ${id}">
        <div class="offer-name">${it.name}</div>
        <div class="offer-sub">${it.packs > 1 ? `${it.packs} packs` : '1 card'}${it.packType === 'grove' ? ' · better odds' : ''}</div>
        <button data-buy="${i}" ${can ? '' : 'disabled'}>Buy · ${it.cost} gold</button>
      </div>`;
    }).join('');
    const rerollLabel = this.rerolls > 0 ? `Reroll (free, ${this.rerolls} left)` : `Reroll · ${SHOP.rerollCost} gold`;
    const canReroll = this.rerolls > 0 || this.gold >= SHOP.rerollCost;
    const team = Array.from({ length: TUNING.maxHelpers }, (_, i) => {
      const t = this.team[i];
      if (!t) return `<div class="chip empty">empty</div>`;
      const d = HEROES[t.id];
      return `<div class="chip" style="--tag:${hex(TAG_COLOR[d.tag])}"><span>${d.name}</span><span class="stars">${'★'.repeat(t.stars)}</span></div>`;
    }).join('');
    return `
      <section class="shop">
        <div class="gold">Gold ${pips} <span class="muted">${this.gold}/${maxGold} · refills every run</span></div>
        <div class="offers">${offers}</div>
        <button class="secondary" data-reroll ${canReroll ? '' : 'disabled'}>${rerollLabel}</button>
        <h2>Your team this run</h2>
        <div class="team">${team}</div>
        <p class="muted">Helpers only last one run. Duplicates add stars.</p>
        <button class="start" data-start>${this.team.length ? 'Start run' : 'Start run with just your Stinger'}</button>
      </section>`;
  }

  treeHtml() {
    const cols = TREE.branches.map(branch => {
      const order = { early: 0, core: 1, late: 2 };
      const nodes = Object.entries(TREE.nodes).filter(([id, n]) => n.branch === branch && nodeVisible(this.save, id))
        .sort(([, a], [, b]) => order[a.tier ?? 'core'] - order[b.tier ?? 'core']).map(([id, n]) => {
        const rank = this.save.nodes[id] ?? 0;
        const max = n.cost.length;
        const cost = n.cost[rank];
        const unlocked = nodeUnlocked(this.save, id);
        const btn = rank >= max ? '<span class="maxed">Maxed</span>'
          : !unlocked ? `<span class="muted">Needs ${TREE.nodes[n.requires!].name}</span>`
          : `<button data-node="${id}" ${this.save.mastery >= cost ? '' : 'disabled'}>${cost} Mastery</button>`;
        return `<div class="node ${rank ? 'owned' : ''} ${unlocked ? '' : 'locked'}">
          <div class="node-top"><b>${n.name}</b><span class="rank">${rank}/${max}</span></div>
          <span class="tier ${n.tier ?? 'core'}">${{ early: 'Buy early', core: 'Core', late: 'Late game' }[n.tier ?? 'core']}</span>
          <div class="muted">${n.desc}</div>${btn}</div>`;
      }).join('');
      const hint = branch === 'Legends'
        ? `<p class="muted small">One node per hero you've pulled. Specialist picks: they only pay off when that hero shows up, so early Mastery is safer in Helpers.</p>`
        : branch === 'Helpers' ? `<p class="muted small">Versatile: these help most teams.</p>` : '';
      return `<div class="branch"><h2>${branch}</h2>${hint}${nodes || '<p class="muted small">Pull heroes to unlock nodes here.</p>'}</div>`;
    }).join('');
    return `
      <section class="tree">
        <div class="gold">Mastery <b>${this.save.mastery}</b></div>
        <p class="muted small">Suggested order: economy first, then attack speed and seed health, then specialisations.</p>
        <div class="branches">${cols}</div>
        <p class="muted small">Quest nodes come next. Costs are still being tuned, so refunds are free for now.</p>
        <button class="secondary" data-refund>Refund all Mastery</button>
        <button class="link" data-reset>Reset all progress</button>
      </section>`;
  }

  collectionHtml() {
    return `<section><p class="muted">The collection binder (every card and variant you've pulled) comes in a later step.</p></section>`;
  }

  revealHtml() {
    const id = this.queue[0];
    const d = HEROES[id];
    const owned = this.team.find(t => t.id === id);
    const full = !owned && this.team.length >= TUNING.maxHelpers;
    const note = owned ? `Duplicate! ${'★'.repeat(starsFor(owned.copies + 1))}` : full ? 'Team full: swap someone out?' : 'New helper';
    const actions = full
      ? `<div class="swap">${this.team.map((t, i) => `<button data-replace="${i}">Swap ${HEROES[t.id].name}</button>`).join('')}<button class="secondary" data-discard>Discard</button></div>`
      : `<button data-keep>Continue</button>`;
    return `
      <div class="reveal">
        <p class="muted">${this.queue.length > 1 ? `${this.queue.length} cards left` : 'Last card'} · tap the card to flip it</p>
        <div class="card ${d.rarity}" data-card>
          <div class="back"><span>?</span></div>
          <div class="face" style="--tag:${hex(TAG_COLOR[d.tag])}">
            <b>${d.name}</b><span>${d.rarity.toUpperCase()}</span><span>${d.tag === 'none' ? '' : d.tag.toUpperCase()}</span><em>${note}</em>
          </div>
        </div>
        <div class="reveal-actions" hidden>${actions}</div>
      </div>`;
  }

  bind() {
    const q = <T extends Element>(sel: string) => Array.from(this.root.querySelectorAll<T & HTMLElement>(sel));
    q<HTMLButtonElement>('[data-tab]').forEach(b => b.onclick = () => { this.tab = b.dataset.tab as Menu['tab']; this.render(); });
    q<HTMLButtonElement>('[data-buy]').forEach(b => b.onclick = () => this.buy(Number(b.dataset.buy)));
    q<HTMLButtonElement>('[data-reroll]').forEach(b => b.onclick = () => this.reroll());
    q<HTMLButtonElement>('[data-node]').forEach(b => b.onclick = () => this.buyNode(b.dataset.node!));
    q<HTMLButtonElement>('[data-start]').forEach(b => b.onclick = () => { this.close(); this.onStart(this.team); });
    q<HTMLButtonElement>('[data-refund]').forEach(b => b.onclick = () => {
      const before = metaStats(this.save);
      refundAll(this.save); writeSave(this.save);
      const after = metaStats(this.save);
      this.gold = Math.max(0, this.gold - (before.maxGold - after.maxGold));
      this.rerolls = Math.max(0, this.rerolls - (before.freeRerolls - after.freeRerolls));
      this.render();
    });
    q<HTMLDivElement>('[data-card]').forEach(c => c.onclick = () => {
      const id = this.queue[0];
      if (!this.save.pulled.includes(id)) { this.save.pulled.push(id); writeSave(this.save); }
      c.classList.add('flipped');
      this.root.querySelector<HTMLElement>('.reveal-actions')!.hidden = false;
    });
    q<HTMLButtonElement>('[data-keep]').forEach(b => b.onclick = () => this.addToTeam(this.queue[0]));
    q<HTMLButtonElement>('[data-replace]').forEach(b => b.onclick = () => this.addToTeam(this.queue[0], Number(b.dataset.replace)));
    q<HTMLButtonElement>('[data-discard]').forEach(b => b.onclick = () => { this.queue.shift(); this.render(); });
    q<HTMLButtonElement>('[data-reset]').forEach(b => b.onclick = () => {
      if (b.dataset.armed) { resetSave(); Object.assign(this.save, freshSave()); this.open(null); return; }
      b.dataset.armed = '1'; b.textContent = 'Tap again to erase all Mastery and upgrades';
    });
  }
}
