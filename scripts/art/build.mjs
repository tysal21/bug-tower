// Builds src/art/<name>.png (2-frame horizontal strips) and art-preview.png from sprites.mjs.
import { mkdirSync } from 'node:fs';
import { SPRITES } from './sprites.mjs';
import { saveStrip, savePreview } from './pixel.mjs';

const out = new URL('../../src/art/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const preview = [];
for (const [name, draw] of Object.entries(SPRITES)) {
  const frames = [draw(0), draw(1)];
  saveStrip(`${out}${name}.png`, frames);
  preview.push(...frames);
}
const previewPath = process.argv[2] ?? new URL('./preview.png', import.meta.url).pathname;
savePreview(previewPath, preview, 6);
console.log(`Wrote ${Object.keys(SPRITES).length} sprites to src/art/ and preview to ${previewPath}`);
