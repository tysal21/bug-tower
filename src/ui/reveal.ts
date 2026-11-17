// The card reveal: face-down card, rarity glow, tap to flip, then keep / swap / discard.
import { icon, heroThumb } from '../art/ui';
// Used by the Market between runs and by Nectar packs opened in the middle of a run.
import { HEROES, SPELLS, TAG_COLOR } from '../game/data';
import { MetaStats, Pull, bump, variantDamage } from '../meta/meta';
import { Loadout, addPull, pullFate, starsFor } from '../meta/run';
import { SaveData, Variant, writeSave } from '../meta/save';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
export const VARIANT_LABEL: Record<Variant, string> = { standard: 'Standard', foil: 'Foil', holo: 'Holo' };

export class Reveal {
  root: HTMLDivElement;
  queue: Pull[] = [];
  flipped = false;
  private shownAt = 0;
  /** Quests finished by cards flipped since the caller last looked. */
  questNews: string[] = [];
  private loadout!: Loadout;
  private stats!: () => MetaStats;
  private onDone: () => void = () => {};

  constructor(private save: SaveData) {
    this.root = document.createElement('div');
    this.root.id = 'reveal';
    this.root.hidden = true;
    document.body.appendChild(this.root);
    window.addEventListener('keydown', e => {
      if (!this.active || (e.code !== 'Space' && e.code !== 'Enter')) return;
      e.preventDefault();
      // Ignore a held key, and the very press that opened the pack.
      if (e.repeat || performance.now() - this.shownAt < 200) return;
      if (!this.flipped) this.flip();
      else if (pullFate(this.loadout, this.queue[0], this.stats()) !== 'full') this.take();
    });
  }

  get active() { return this.queue.length > 0; }

  /** Queues cards to reveal one by one. onDone runs when the last one has been dealt with. */
  show(pulls: Pull[], loadout: Loadout, stats: () => MetaStats, onDone: () => void) {
    if (!pulls.length) return;
    this.loadout = loadout; this.stats = stats; this.onDone = onDone;
    const wasActive = this.active;
    this.queue.push(...pulls);
    if (!wasActive) { this.flipped = false; this.shownAt = performance.now(); this.render(); }
  }

  private flip() {
    const pull = this.queue[0];
    this.flipped = true;
    // Seeing the card is what counts for the Collection and for quests.
    if (pull.kind === 'spell') {
      if (!this.save.spellsPulled.includes(pull.id)) this.save.spellsPulled.push(pull.id);
    } else {
      if (!this.save.pulled.includes(pull.id)) this.save.pulled.push(pull.id);
      const vs = (this.save.variants[pull.id] ??= []);
      if (!vs.includes(pull.variant)) vs.push(pull.variant);
    }
    this.questNews.push(...bump(this.save, `pull:${pull.id}`));
    writeSave(this.save);
    this.root.querySelector('[data-card]')?.classList.add('flipped');
    const actions = this.root.querySelector<HTMLElement>('.reveal-actions');
    if (actions) actions.hidden = false;
  }

  private take(replaceIndex?: number) {
    addPull(this.loadout, this.queue[0], this.stats(), replaceIndex);
    this.next();
  }

  private next() {
    this.queue.shift();
    this.flipped = false;
    if (this.queue.length) { this.render(); return; }
    this.root.hidden = true;
    this.root.innerHTML = '';
    this.onDone();
  }

  private render() {
    const pull = this.queue[0];
    const m = this.stats();
    const spell = pull.kind === 'spell';
    const fate = pullFate(this.loadout, pull, m);
    const name = spell ? SPELLS[pull.id].name : HEROES[pull.id].name;
    const tag = spell ? SPELLS[pull.id].tag : HEROES[pull.id].tag;
    const rarity = spell ? 'spell' : HEROES[pull.id].rarity;
    const owned = spell ? this.loadout.spells.find(s => s.id === pull.id) : this.loadout.team.find(t => t.id === pull.id);
    const fancy = pull.variant !== 'standard' ? `${VARIANT_LABEL[pull.variant]} · +${variantDamage(pull.variant) * 100}% damage` : '';
    const note = fate === 'merge' ? `Duplicate! ${'★'.repeat(starsFor(owned!.copies + 1))}`
      : fate === 'full' ? (spell ? 'Spell slots full: swap one out?' : 'Team full: swap someone out?')
      : spell ? 'New spell' : pull.id === 'ant' && m.antStart ? 'New helper ★★' : 'New helper';
    const swaps = spell
      ? this.loadout.spells.map((s, i) => `<button data-replace="${i}">Swap ${SPELLS[s.id].name}</button>`)
      : this.loadout.team.map((t, i) => `<button data-replace="${i}">Swap ${HEROES[t.id].name}</button>`);
    const actions = fate === 'full'
      ? `<div class="swap">${swaps.join('')}<button class="secondary" data-discard>Discard</button></div>`
      : `<button data-keep>Continue</button>`;
    this.root.hidden = false;
    this.root.innerHTML = `
      <div class="reveal">
        <p class="muted">${this.queue.length > 1 ? `${this.queue.length} cards left` : 'Last card'} · tap the card (or press Space) to flip it</p>
        <div class="card ${rarity} ${pull.variant}" data-card>
          <div class="back"></div>
          <div class="face" style="--tag:${hex(TAG_COLOR[tag])}">
            ${spell ? `<span class="spell-icon">${icon(pull.id, SPELLS[pull.id].icon)}</span>` : `<img class="hero-art" src="${heroThumb(pull.id)}" alt="">`}
            <b>${name}</b><span>${rarity.toUpperCase()}</span><span>${tag === 'none' ? '' : tag.toUpperCase()}</span>
            ${spell ? `<small>${SPELLS[pull.id].desc}</small>` : ''}
            ${fancy ? `<strong class="vtag">${icon(pull.variant)} ${fancy}</strong>` : ''}<em>${note}</em>
          </div>
        </div>
        <div class="reveal-actions" hidden>${actions}</div>
      </div>`;
    const q = (sel: string) => Array.from(this.root.querySelectorAll<HTMLElement>(sel));
    q('[data-card]').forEach(c => c.onclick = () => { if (!this.flipped) this.flip(); });
    q('[data-keep]').forEach(b => b.onclick = () => this.take());
    q('[data-replace]').forEach(b => b.onclick = () => this.take(Number(b.dataset.replace)));
    q('[data-discard]').forEach(b => b.onclick = () => this.next());
  }
}
