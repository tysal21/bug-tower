// Every sprite in the game, drawn in code. Run `npm run art` to rebuild the PNGs in src/art/.
// Sprites face right in side profile (the game flips them when they walk left).
// Each sprite is a function of the frame number (0 or 1) for a simple two-frame walk/flap.
import { Sprite, P } from './pixel.mjs';

const A = (c, a) => c + a; // add alpha: A(P.wing, 'aa')
const R = {
  ant: [P.brown0, P.red1, P.red2, P.red3],
  gold: [P.gold0, P.gold1, P.gold2, P.gold3],
  green: [P.green0, P.green1, P.green2, P.green3],
  brown: [P.brown0, P.brown1, P.brown2, P.brown3],
  blue: [P.blue0, P.blue1, P.blue2, P.blue3],
  steel: [P.steel0, P.steel1, P.steel2, P.steel3, P.steel4],
  orange: [P.red1, P.orange1, P.orange2, P.orange3],
  spider: ['#1f1726', P.blight0, P.blight1, P.blight2],
  dark: ['#150f12', '#2a1d1a', P.brown0, P.brown1],
  stag: ['#140c0a', P.brown0, P.brown1, P.brown3],
  toad: ['#1f2a14', '#3e4f22', '#66783a', '#98a85a'],
  glow: [P.glow0, P.glow1, P.glow2, P.glow3],
  blight: [P.blight0, P.blight1, P.blight2, P.blight3],
};

/** Fill only empty pixels (glows, halos). */
function under(s, cx, cy, rx, ry, c) {
  s.ellipse(cx, cy, rx, ry, c, (dx, dy, x, y) => !s.get(x, y));
}
/** Translucent insect wing with a light rim. */
function wing(s, cx, cy, rx, ry) {
  s.ellipse(cx, cy, rx, ry, (dx, dy) => (dx * dx + dy * dy > 0.55 ? A(P.wingEdge, 'dd') : A(P.wing, '99')));
}
/** Thin legs drawn after the outline so they stay one pixel wide. */
function legs(s, list, c = P.ink) { for (const l of list) s.path(l, c); }

// ---------------------------------------------------------------- heroes (20x20)

export function ant(f) {
  const s = new Sprite(20, 20);
  s.blob(5.5, 11, 4, 3.4, R.ant);          // gaster
  s.rect(9, 11, 2, 1, P.red1);             // waist
  s.blob(11.5, 10.5, 2.4, 1.9, R.ant);     // thorax
  s.blob(15.5, 9.5, 2.6, 2.3, R.ant);      // head
  // Legionnaire helmet with a red crest
  s.ellipse(15.5, 8, 3, 1.6, (dx, dy) => (dx < -0.2 ? P.gold1 : P.gold2), (dx, dy) => dy <= 0.2);
  s.dots([[13, 6], [14, 5], [15, 5], [16, 5]], P.red2).dots([[14, 6], [15, 6]], P.red1);
  s.outline();
  s.dots([[16, 9]], P.ink).dots([[17, 9]], P.white);         // eye
  s.dots([[18, 11], [19, 11]], P.ink);                      // mandible
  legs(s, [[[18, 7], [19, 5], [19, 4]]]);                   // antenna
  const k = f ? 1 : 0;
  legs(s, [
    [[10, 12], [9, 14], [8 + k, 16]],
    [[11, 12], [12, 14], [11 - k, 16]],
    [[13, 12], [14, 14], [15 - k, 16]],
  ]);
  return s;
}

export function orbweaver(f) {
  const s = new Sprite(20, 20);
  s.blob(7, 8, 5, 4.5, R.spider);
  // orb-weaver markings
  s.dots([[5, 6], [7, 5], [9, 6], [6, 8], [8, 8], [7, 10]], P.gold2).dots([[4, 9], [10, 9]], P.gold1);
  s.blob(13, 11, 3, 2.4, R.spider);
  s.outline();
  s.dots([[15, 10], [14, 10]], P.red3).dots([[16, 12]], P.ink);
  const k = f ? 1 : 0;
  legs(s, [
    [[14, 10], [16, 7 + k], [19, 15]],
    [[13, 12], [15, 9 - k], [17, 16]],
    [[12, 13], [10, 13], [8 + k, 16]],
    [[11, 12], [6, 13], [3, 16 - k]],
  ]);
  // a strand of silk trailing up
  s.line(5, 0, 5, 2, A(P.steel4, 'aa'));
  return s;
}

export function firefly(f) {
  const s = new Sprite(20, 20);
  s.blob(5, 11.5, 3.6, 2.8, R.glow);                         // lantern tail
  s.blob(10, 10.5, 4, 2.8, ['#141019', P.shadow, '#4a4058', '#6d6380']);
  s.blob(14.5, 9.5, 2.4, 2.1, [P.red0, P.red1, P.red2, P.red3]); // red head shield
  s.blob(17, 10.5, 1.4, 1.4, ['#141019', P.shadow, '#4a4058']);
  s.outline();
  under(s, 5, 11.5, 6, 5, A(P.glow2, f ? '55' : '33'));
  wing(s, 9, f ? 6 : 5, 4, f ? 1.5 : 2.2);
  legs(s, [[[18, 9], [19, 7]], [[9, 13], [8, 15]], [[11, 13], [11, 15]], [[13, 12], [14, 15]]]);
  return s;
}

export function bee(f) {
  const s = new Sprite(20, 20);
  s.blob(6, 11, 4, 3.4, R.gold);
  s.recolor(c => c.startsWith('#'), '#2a1d16', (x, y) => (x === 4 || x === 7) && y > 7);   // stripes
  s.blob(11, 10, 2.8, 2.6, [P.brown1, P.brown2, P.brown3, P.gold3]);                    // fuzzy thorax
  s.blob(14.5, 10, 2.1, 2.1, ['#2a1d16', P.brown0, P.brown1]);
  s.outline();
  s.dots([[1, 12], [2, 12]], P.ink);                                                     // stinger
  s.dots([[15, 9]], P.white);
  wing(s, 10, f ? 4 : 5, 3.6, f ? 2.3 : 1.6);
  legs(s, [[[15, 8], [16, 5], [17, 5]], [[10, 12], [9, 15]], [[12, 12], [12, 15]]]);
  // lance held forward
  s.line(9, 14, 18, 13, P.brown2).dots([[19, 13]], P.steel4).dots([[18, 12], [18, 14]], P.steel3);
  return s;
}

export function bombardier(f) {
  const s = new Sprite(20, 20);
  s.blob(9, 10.5, 5.5, 4, R.blue);
  s.line(5, 9, 12, 8, P.blue3);                                  // shell sheen
  s.blob(14.5, 10, 2.5, 2.5, R.orange);
  s.blob(17, 10.5, 1.5, 1.5, R.orange);
  s.outline();
  s.dots([[17, 10]], P.ink);
  legs(s, [[[18, 9], [19, 7]], [[7, 14], [6 + (f ? 1 : 0), 16]], [[10, 14], [10, 16]], [[13, 13], [14 - (f ? 1 : 0), 16]]]);
  // hot spray puff from the rear
  const puff = A(P.pale3, 'cc');
  if (f) { s.ellipse(2, 8, 1.5, 1.5, puff); s.ellipse(1, 5, 1, 1, A(P.pale3, '88')); }
  else { s.ellipse(2.5, 9, 1, 1, puff); s.ellipse(1.5, 6.5, 1.3, 1.3, A(P.pale3, 'aa')); }
  s.dots([[3, 10]], P.orange3);
  return s;
}

export function trapdoor(f) {
  const s = new Sprite(20, 20);
  s.ellipse(10, 17.5, 8, 1.6, (dx) => (dx < 0 ? P.brown1 : P.brown0));   // dirt mound
  s.blob(7, 12, 4.5, 3.6, R.brown);
  s.recolor(P.brown2, P.brown1, (x, y) => (x + y) % 4 === 0);             // hairy texture
  s.blob(12.5, 12.5, 3, 2.4, R.brown);
  s.outline();
  s.dots([[12, 10], [13, 10]], P.gold3).dots([[15, 14], [15, 15]], P.ink);
  const k = f ? 1 : 0;
  legs(s, [
    [[14, 12], [16, 9], [18, 16 - k]],
    [[13, 13], [15, 11 - k], [16, 16]],
    [[11, 13], [9, 12 + k], [6, 16]],
    [[10, 14], [4, 13], [2, 16]],
  ], P.ink);
  return s;
}

export function stag(f) {
  const s = new Sprite(24, 22);
  s.blob(8, 13, 6, 4.5, R.stag);
  s.dots([[5, 10], [6, 10]], P.steel3);                               // glossy glint
  s.blob(14, 12, 2.8, 3, R.stag);
  s.blob(16.5, 12, 2, 2.2, R.stag);
  // great antler mandibles
  s.path([[17, 11], [19, 9], [20, 6], [21, 3]], P.red1).path([[18, 11], [20, 9], [21, 6], [22, 4]], P.red2);
  s.path([[20, 7], [18, 5]], P.red2);
  s.path([[18, 13], [20, 13], [22, 11]], P.red1);
  s.outline();
  s.dots([[16, 11]], P.gold2).dots([[21, 3], [22, 4]], P.red3);
  const k = f ? 1 : 0;
  legs(s, [[[6, 17], [5, 19], [4 + k, 20]], [[10, 17], [10, 20]], [[14, 15], [15, 18], [16 - k, 20]]]);
  return s;
}

export function mantis(f) {
  const s = new Sprite(20, 24);
  s.blob(6, 17, 5.5, 2.8, R.green);                                         // abdomen
  s.ellipse(7, 15.5, 5, 1.7, (dx) => (dx < 0 ? P.green3 : P.green2));         // folded wings
  s.poly([[9, 18], [12, 18], [14.5, 10], [11.5, 10]], (x) => (x < 12 ? P.green3 : P.green2)); // rising thorax
  s.blob(14.5, 7.5, 3, 2.4, R.green);                                       // head
  s.dots([[17, 9], [18, 9]], P.green2);                                     // jaw
  // raptorial arms folded in prayer
  s.path([[13, 11], [16, 13], [17, 13]], P.green3).path([[13, 12], [16, 14]], P.green2);
  s.path([[17, 13], [17, 10], [16, 9]], P.green3);
  s.outline();
  s.dots([[15, 6], [16, 6], [16, 7]], P.green4).dots([[16, 7]], P.ink);     // big compound eye
  s.dots([[15, 13], [14, 12]], P.pale3);                                    // arm spikes
  legs(s, [[[16, 5], [18, 2], [19, 1]]], P.green1);                         // antenna
  // saint's halo
  s.ellipse(13.5, 2, 3.2, 1.1, A(P.gold2, f ? 'ff' : 'cc'), (dx, dy) => dx * dx + dy * dy > 0.4);
  const k = f ? 1 : 0;
  legs(s, [[[9, 19], [8, 21], [7 + k, 23]], [[11, 19], [12, 21], [13 - k, 23]], [[5, 19], [4, 23]]]);
  return s;
}

// ---------------------------------------------------------------- enemies

export function grub(f) {
  const s = new Sprite(16, 12);
  const ramp = [P.blight1, P.pale1, P.pale2, P.pale3];
  const bob = f ? [0, -1, -1, 0] : [0, 0, 0, 0];
  [[3, 7.5], [6, 6.8], [9, 6.5], [12, 6.8]].forEach(([x, y], i) => s.blob(x, y + bob[i], 2.6, 2.5, ramp));
  s.blob(13.5, 6.8, 1.9, 2, [P.brown0, P.brown1, P.brown2]);
  s.dots([[5, 8], [8, 5], [10, 8], [3, 6]], P.blight2);                  // blight spots
  s.outline(P.blight0);
  s.dots([[14, 6]], P.ink);
  return s;
}

export function wasp(f) {
  const s = new Sprite(18, 16);
  s.ellipse(5, 9.5, 4.2, 2.8, (dx, dy) => (-dy > 0.4 ? P.gold3 : dy > 0.5 ? P.gold1 : P.gold2));
  s.recolor(() => true, '#20140c', (x, y) => (x === 3 || x === 6) && y > 6);
  s.blob(11, 8, 2.5, 2.2, ['#20140c', P.brown0, P.brown1]);
  s.blob(14.5, 8, 2, 2, R.gold);
  s.outline();
  s.dots([[15, 7], [15, 8]], P.red1).dots([[16, 9]], P.ink);
  s.dots([[0, 11], [1, 10]], P.ink);                                     // stinger
  wing(s, 9, f ? 3 : 4, 4, f ? 2.2 : 1.3);
  legs(s, [[[10, 10], [9, 13]], [[12, 10], [12, 13]], [[16, 6], [17, 4]]]);
  return s;
}

export function snail(f) {
  const s = new Sprite(22, 18);
  const st = f ? 1 : 0;
  s.ellipse(11 + st / 2, 15, 9 + st / 2, 2.2, (dx, dy) => (dy < 0 ? P.blight2 : P.blight1));   // foot
  s.blob(18 + st, 12, 2.4, 3.2, R.blight);                                                      // head
  s.blob(9, 8, 6.5, 6, R.steel);                                                                // iron shell
  // spiral
  const pts = [];
  for (let t = 0; t < 3.6 * Math.PI; t += 0.2) { const r = 0.4 + t * 0.42; pts.push([9 + Math.cos(t) * r * 0.9, 8 + Math.sin(t) * r * 0.85]); }
  s.path(pts.map(([x, y]) => [Math.round(x), Math.round(y)]), P.steel0);
  s.dots([[6, 4], [7, 4], [5, 5]], P.steel4);
  s.dots([[4, 5], [9, 2], [14, 6], [13, 12], [5, 12]], P.steel4);                               // rivets
  s.outline();
  legs(s, [[[18 + st, 9], [19 + st, 6], [20 + st, 4]], [[17 + st, 9], [17 + st, 6]]], P.blight1);
  s.dots([[20 + st, 3], [17 + st, 5]], P.ink);
  return s;
}

export function wisp(f) {
  const s = new Sprite(16, 18);
  const tip = f ? 9 : 7;
  s.poly([[tip, 0], [12, 5], [13.5, 11], [11, 16], [5, 16], [2.5, 11], [4, 5]], A(P.blight2, 'cc'));
  s.ellipse(8, 11, 4, 4, A(P.blight3, 'dd'));
  s.ellipse(8.5, 11.5, 2.2, 2.4, A(P.blight4, 'ee'));
  s.outline(A(P.blight0, 'cc'));
  s.dots([[9, 10], [11, 10]], P.ink).dots([[10, 13]], P.blight1);
  under(s, 8, 10, 8, 9, A(P.blight3, '22'));
  return s;
}

export function toad(f) {
  const s = new Sprite(32, 26);
  const t = R.toad;
  s.blob(8, 18, 5, 5, t);                                  // haunch
  s.blob(15, 15, 11, 8, t);                                // body
  s.blob(23, 12, 6, 5, t);                                 // head
  s.ellipse(19, 19, 7, 3.4, (dx, dy) => (dy < 0 ? P.pale2 : P.pale1), (dx, dy, x, y) => !!s.get(x, y)); // belly
  s.blob(24, 7.5, 2.6, 2.3, t);                            // eye bump
  s.blob(24, 21 + (f ? -1 : 0), 2.4, 3, t);                // front leg
  s.rect(3, 23, 8, 1, t[1]).rect(21, 23, 6, 1, t[1]);      // feet
  s.dots([[10, 10], [14, 9], [17, 12], [8, 14], [12, 13], [20, 9]], t[0]).dots([[11, 9], [15, 8], [9, 13]], t[3]); // warts
  s.outline();
  s.dots([[24, 7], [25, 7]], P.gold2).dots([[25, 7]], P.ink);
  s.path([[20, 14], [24, 15], [29, 13]], P.ink);           // grumpy mouth
  s.dots([[18, 10], [19, 11], [20, 10]], P.red1);           // scar
  return s;
}

export function frogking(f) {
  const s = new Sprite(48, 44);
  // royal cape behind
  s.poly([[10, 18], [26, 14], [24, 40], [4, 41]], (x, y) => (x < 10 ? P.red0 : x < 18 ? P.red1 : P.red2));
  s.rect(4, 40, 21, 1, P.gold2);
  s.blob(15, 34, 7, 6, R.green);                           // haunch
  s.blob(23, 28, 12, 10, R.green);                         // body
  s.blob(31, 18, 10, 7, R.green);                          // head
  s.ellipse(30, 30, 5.5, 7, (dx, dy) => (dy < -0.3 ? P.gold3 : P.pale2), (dx, dy, x, y) => !!s.get(x, y)); // belly
  s.blob(36, 13, 3.6, 3.2, R.green);                       // eye bump
  s.blob(35, 35 + (f ? -1 : 0), 3, 4, R.green);            // arm
  s.rect(8, 40, 10, 2, P.green1).rect(32, 40, 8, 2, P.green1);  // feet
  // crown
  s.poly([[21, 11], [23, 4], [25.5, 8], [27.5, 2], [29.5, 8], [32, 4], [34, 11]], P.gold2);
  s.rect(21, 10, 13, 2, P.gold1);
  s.outline();
  s.dots([[27, 3], [23, 5], [32, 5]], P.red2).dots([[27, 9]], P.blue3).dots([[22, 9], [26, 6]], P.gold3);
  s.dots([[35, 12], [36, 12], [35, 13], [36, 13], [37, 12], [37, 13]], P.gold2).dots([[36, 12], [36, 13]], P.ink);
  s.path([[27, 21], [33, 22], [40, 19]], P.ink);           // wide royal frown
  // sceptre
  s.line(39, 40, 43, 22, P.gold1).line(40, 40, 44, 22, P.gold2);
  s.ellipse(44, 20, 1.6, 1.6, P.blight3).dots([[43, 19]], P.blight4);
  return s;
}

// ---------------------------------------------------------------- base and packs

export function heartseed(f) {
  const s = new Sprite(36, 36);
  s.path([[18, 13], [18, 6]], P.green2).path([[19, 13], [19, 7]], P.green1);
  s.blob(13, 7, 5, 2.4, R.green);
  s.blob(24, 5, 5, 2.4, R.green);
  s.line(9, 7, 16, 7, P.green1).line(21, 5, 27, 4, P.green1);
  s.blob(18, 23, 12, 10.5, R.brown);
  s.line(11, 18, 13, 15, P.brown3);                        // shell highlight
  s.outline();
  // glowing heart in the seed
  const g = f ? [P.glow2, P.glow3] : [P.glow1, P.glow2];
  s.ellipse(15.5, 21.5, 2.6, 2.6, g[0]).ellipse(20.5, 21.5, 2.6, 2.6, g[0]).poly([[13, 22.5], [23, 22.5], [18, 28]], g[0]);
  s.ellipse(16, 21.5, 1, 1, g[1]).ellipse(20, 22.5, 1.2, 1.2, g[1]).dots([[18, 24], [18, 25]], g[1]);
  s.path([[18, 28], [17, 31]], P.brown0).path([[23, 23], [27, 25]], P.brown0);  // cracks of light
  return s;
}

export function pack(kind) {
  return (f) => {
    const s = new Sprite(24, 32);
    const body = kind === 'grove' ? [P.blight0, P.blight1, P.blight2, P.blight3] : [P.green0, P.green1, P.green2, P.green3];
    s.rect(3, 3, 18, 26, body[2]);
    s.rect(3, 3, 2, 26, body[3]).rect(19, 3, 2, 26, body[1]);
    // foil crimps, top and bottom
    for (let x = 2; x < 22; x++) { s.set(x, 1 + (x % 2), P.steel3); s.set(x, 2, P.steel2); s.set(x, 29, P.steel2); s.set(x, 30 - (x % 2), P.steel3); }
    // emblem: a little beetle on a gold medallion
    s.blob(12, 15, 5.5, 5.5, R.gold);
    s.blob(11.5, 16, 2.6, 2, ['#20140c', P.brown0, P.brown1]).blob(14.5, 15, 1.4, 1.3, ['#20140c', P.brown0]);
    s.dots([[15, 13], [16, 12]], P.ink).dots([[10, 18], [12, 18], [13, 18]], P.ink);
    s.rect(6, 23, 12, 2, P.gold2);                         // label band
    s.outline();
    // moving sheen
    const off = f ? 8 : 0;
    for (let i = 0; i < 26; i++) { const x = 4 + off + Math.floor(i / 2), y = 27 - i; if (s.get(x, y) && x < 21) s.set(x, y, A(P.white, '55')); }
    return s;
  };
}

/** name -> draw function. Order here is the order on the preview sheet. */
export const SPRITES = {
  ant, orbweaver, firefly, bee, bombardier, trapdoor, stag, mantis,
  grub, wasp, snail, wisp, toad, frogking,
  heartseed, pack_meadow: pack('meadow'), pack_grove: pack('grove'),
};
