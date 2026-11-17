// PixelLab UI art: frames, buttons, skill cells, card frames, HUD pieces and icons.
// Built by scripts/art/build_ui.py into src/art/ui/. The menus use them through CSS variables
// set here (--ui-<name>), so index.html only needs `border-image: var(--ui-panel) ...`.
import Phaser from 'phaser';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';

const pieces = import.meta.glob<string>('./ui/*.png', { eager: true, query: '?url', import: 'default' });
const icons = import.meta.glob<string>('./ui/icons/*.png', { eager: true, query: '?url', import: 'default' });

const heroes = import.meta.glob<string>('./ui/heroes/*.png', { eager: true, query: '?url', import: 'default' });
const base = (p: string) => p.split('/').pop()!.replace('.png', '');
export const UI: Record<string, string> = Object.fromEntries(Object.entries(pieces).map(([p, u]) => [base(p), u]));
export const ICONS: Record<string, string> = Object.fromEntries(Object.entries(icons).map(([p, u]) => [base(p), u]));

const HERO_THUMBS: Record<string, string> = Object.fromEntries(Object.entries(heroes).map(([p, u]) => [base(p), u]));
/** Still image of a hero (first animation frame). */
export const heroThumb = (id: string) => HERO_THUMBS[id] ?? '';

export const PIXEL_FONT = '"Pixelify Sans", ui-monospace, monospace';

/** Exposes every piece as a CSS variable, e.g. --ui-panel: url(...). Call once at startup. */
export function installUiCss() {
  const root = document.documentElement.style;
  for (const [k, u] of Object.entries(UI)) root.setProperty(`--ui-${k.replace(/_/g, '-')}`, `url("${u}")`);
}

/** An inline pixel icon for menu HTML. Falls back to the given text when there's no icon. */
export function icon(name: string | undefined, fallback = '', cls = '') {
  const u = name && ICONS[name];
  return u ? `<img class="px-icon ${cls}" src="${u}" alt="" draggable="false">` : fallback;
}

/** Skill tree node id -> icon name, where they differ. */
const NODE_ICON: Record<string, string> = { nectar: 'sweetNectar' };
export const nodeIcon = (id: string) => NODE_ICON[id] ?? id;

/** Phaser: load the HUD pieces and battle map. */
export function loadUi(scene: Phaser.Scene) {
  for (const k of ['bg_map', 'bar_frame', 'boss_frame', 'spell_slot', 'btn_gold', 'inset']) {
    if (!scene.textures.exists('ui_' + k)) scene.load.image('ui_' + k, UI[k]);
  }
  for (const k of ['nectar', 'silkstorm', 'embers', 'rally', 'mastery']) {
    if (!scene.textures.exists('icon_' + k)) scene.load.image('icon_' + k, ICONS[k]);
  }
}

/** Crisp pixels for the UI textures (call from create()). */
export function crispUi(scene: Phaser.Scene) {
  for (const k of scene.textures.getTextureKeys()) {
    if (k.startsWith('ui_') || k.startsWith('icon_')) scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
