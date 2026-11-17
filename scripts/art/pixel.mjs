// Tiny pixel-art toolkit: draw with shapes on a small grid, auto-outline, write PNGs.
// No dependencies (PNG encoding uses node's zlib).
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

/** Shared palette: every sprite picks its colours from here so the set stays cohesive. */
export const P = {
  ink: '#1b1424',      // outline
  shadow: '#2a2033',
  // warm browns
  brown0: '#3b2219', brown1: '#6b3a24', brown2: '#9a5a32', brown3: '#c98a4b',
  // reds
  red0: '#4a1420', red1: '#8f2a2a', red2: '#c8473a', red3: '#ef7a55',
  // golds / yellows
  gold0: '#6b4a12', gold1: '#b9801f', gold2: '#f2c14e', gold3: '#fff1a8',
  // greens
  green0: '#16301f', green1: '#2f5a2c', green2: '#5b8f3a', green3: '#9bcf5a', green4: '#d6f28a',
  // blight purples
  blight0: '#2b1838', blight1: '#563064', blight2: '#8c5aa0', blight3: '#c79ad8', blight4: '#efd6ff',
  // steel / shell greys
  steel0: '#2c3140', steel1: '#4c5468', steel2: '#7d879c', steel3: '#b9c2d3', steel4: '#eef2f7',
  // night blues
  blue0: '#141b33', blue1: '#263763', blue2: '#3f63a8', blue3: '#7fa8e0',
  // pale flesh / larva
  pale0: '#6f5a4a', pale1: '#a98f74', pale2: '#d9c3a0', pale3: '#f4e6c8',
  // glow
  glow0: '#5f8f1a', glow1: '#b6e83a', glow2: '#efff8a', glow3: '#ffffff',
  white: '#ffffff', wing: '#d8ecff', wingEdge: '#9cc3e6',
  orange1: '#c25a1a', orange2: '#f08a2a', orange3: '#ffc06a',
};

export class Sprite {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.px = new Array(w * h).fill(null);
  }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.px[y * this.w + x]; }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.px[y * this.w + x] = c; return this;
  }
  /** Draw a list of [x, y] points. */
  dots(pts, c) { for (const [x, y] of pts) this.set(x, y, c); return this; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
  /** Filled ellipse, centre (cx, cy), radii rx/ry. Works with half-pixel centres. */
  ellipse(cx, cy, rx, ry, c, test) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.01), dy = (y - cy) / (ry + 0.01);
        if (dx * dx + dy * dy <= 1 && (!test || test(dx, dy, x, y))) this.set(x, y, typeof c === 'function' ? c(dx, dy) : c);
      }
    return this;
  }
  /**
   * Shaded ellipse lit from the top-left: ramp = [dark, mid, light, (spec)].
   */
  blob(cx, cy, rx, ry, ramp, light = 1) {
    return this.ellipse(cx, cy, rx, ry, (dx, dy) => {
      const l = -dx * 0.55 - dy * 0.85; // brightness toward the top-left
      if (ramp[3] && l > 0.78 * light && dx * dx + dy * dy > 0.15) return ramp[3];
      if (l > 0.3 * light) return ramp[2];
      if (l < -0.45) return ramp[0];
      return ramp[1];
    });
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  /** Polyline through points. */
  path(pts, c) { for (let i = 1; i < pts.length; i++) this.line(...pts[i - 1], ...pts[i], c); return this; }
  /** Filled polygon (even-odd). */
  poly(pts, c) {
    const ys = pts.map(p => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, typeof c === 'function' ? c(x, y) : c);
    }
    return this;
  }
  /** Recolour pixels matching `from` (a colour or predicate). */
  recolor(from, to, area) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.get(x, y);
      if (c && (typeof from === 'function' ? from(c, x, y) : c === from) && (!area || area(x, y))) this.set(x, y, to);
    }
    return this;
  }
  /** One-pixel outline around everything drawn so far. `diag` also fills diagonal corners. */
  outline(c = P.ink, diag = false) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1], ...(diag ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : [])];
      if (n.some(([i, j]) => this.get(x + i, y + j) && this.get(x + i, y + j) !== c)) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, c);
    return this;
  }
  /** Mirror horizontally (sprites face right by default). */
  flipped() {
    const s = new Sprite(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) s.set(this.w - 1 - x, y, this.get(x, y));
    return s;
  }
  /** Copy shifted by (dx, dy), used for simple bob frames. */
  shifted(dx, dy) {
    const s = new Sprite(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) s.set(x + dx, y + dy, this.get(x, y));
    return s;
  }
  clone() { const s = new Sprite(this.w, this.h); s.px = [...this.px]; return s; }
}

function rgba(c) {
  if (!c) return [0, 0, 0, 0];
  const n = parseInt(c.slice(1, 7), 16);
  const a = c.length > 7 ? parseInt(c.slice(7, 9), 16) : 255;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Encode RGBA rows as PNG. getPixel(x, y) -> [r,g,b,a]. */
export function encodePng(w, h, getPixel) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(getPixel(x, y), y * (w * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Save frames side by side as one horizontal strip (a Phaser spritesheet). */
export function saveStrip(path, frames) {
  const fw = frames[0].w, fh = frames[0].h;
  writeFileSync(path, encodePng(fw * frames.length, fh, (x, y) => rgba(frames[Math.floor(x / fw)].get(x % fw, y))));
}

/** A big preview sheet: every sprite scaled up on a meadow-coloured background. */
export function savePreview(path, sprites, scale = 6, bg = '#23301c') {
  const pad = 4;
  const cellW = Math.max(...sprites.map(s => s.w)) + pad * 2;
  const rows = [];
  let row = [], rowW = 0;
  for (const s of sprites) {
    if (rowW + s.w + pad * 2 > cellW * 4 && row.length) { rows.push(row); row = []; rowW = 0; }
    row.push(s); rowW += s.w + pad * 2;
  }
  rows.push(row);
  const W = Math.max(...rows.map(r => r.reduce((a, s) => a + s.w + pad * 2, 0)));
  const rowH = rows.map(r => Math.max(...r.map(s => s.h)) + pad * 2);
  const H = rowH.reduce((a, b) => a + b, 0);
  const grid = new Array(W * H).fill(null);
  let oy = 0;
  rows.forEach((r, ri) => {
    let ox = 0;
    for (const s of r) {
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        const c = s.get(x, y);
        if (c) grid[(oy + pad + rowH[ri] - pad * 2 - s.h + y) * W + ox + pad + x] = c;
      }
      ox += s.w + pad * 2;
    }
    oy += rowH[ri];
  });
  const bgc = rgba(bg);
  writeFileSync(path, encodePng(W * scale, H * scale, (x, y) => {
    const c = grid[Math.floor(y / scale) * W + Math.floor(x / scale)];
    if (!c) return bgc;
    const [r, g, b, a] = rgba(c);
    const t = a / 255;
    return [Math.round(r * t + bgc[0] * (1 - t)), Math.round(g * t + bgc[1] * (1 - t)), Math.round(b * t + bgc[2] * (1 - t)), 255];
  }));
}
