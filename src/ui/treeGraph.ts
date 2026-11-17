// Lays the skill tree out as a radial honeycomb: six branches grow out of the Heartseed in the middle.
import { TREE } from '../meta/meta';

export interface Placed { id: string; x: number; y: number; depth: number; parent?: string; branch: string }
export interface BranchLabel { name: string; x: number; y: number; color: string; anchor: string }

const R0 = 1.9;    // distance from the seed to the first ring of nodes
const DR = 1.3;    // distance between rings
const SECTOR = 56; // degrees each branch may fan out over (60 = touching the next branch)

let cache: { nodes: Record<string, Placed>; labels: BranchLabel[]; box: [number, number, number, number] } | null = null;

export function treeLayout() {
  if (cache) return cache;
  const nodes: Record<string, Placed> = {};
  const labels: BranchLabel[] = [];
  const ids = Object.keys(TREE.nodes);
  for (const [branch, b] of Object.entries(TREE.branches)) {
    const mine = ids.filter(id => TREE.nodes[id].branch === branch);
    const kids = (p?: string) => mine.filter(id => TREE.nodes[id].parent === p);
    const leaves = (id: string): number => { const k = kids(id); return k.length ? k.reduce((a, c) => a + leaves(c), 0) : 1; };
    const roots = kids(undefined);
    const total = roots.reduce((a, r) => a + leaves(r), 0);
    const slot = SECTOR / total;
    let maxR = 0;
    // Each subtree gets a slice of the branch's angle in proportion to how many leaves it has.
    const place = (id: string, from: number, depth: number) => {
      const span = leaves(id) * slot;
      const ang = ((b.angle - SECTOR / 2 + from + span / 2) * Math.PI) / 180;
      const r = R0 + depth * DR;
      maxR = Math.max(maxR, r);
      nodes[id] = { id, x: Math.cos(ang) * r, y: Math.sin(ang) * r, depth, parent: TREE.nodes[id].parent, branch };
      let f = from;
      for (const c of kids(id)) { place(c, f, depth + 1); f += leaves(c) * slot; }
    };
    let f = 0;
    for (const r of roots) { place(r, f, 0); f += leaves(r) * slot; }
    const a = (b.angle * Math.PI) / 180, lr = maxR + 0.85;
    const cx = Math.cos(a);
    labels.push({ name: branch, x: cx * lr, y: Math.sin(a) * lr, color: b.color, anchor: cx > 0.3 ? 'start' : cx < -0.3 ? 'end' : 'middle' });
  }
  const pts = [...Object.values(nodes), ...labels];
  const pad = 0.7;
  let minX = Math.min(...pts.map(p => p.x)) - pad, maxX = Math.max(...pts.map(p => p.x)) + pad;
  const minY = Math.min(...pts.map(p => p.y)) - pad, maxY = Math.max(...pts.map(p => p.y)) + pad;
  // Labels anchored at start/end stick out sideways: leave room for the text.
  minX -= 1.1; maxX += 1.1;
  cache = { nodes, labels, box: [minX, minY, maxX - minX, maxY - minY] };
  return cache;
}

/** Points of a flat-topped hexagon of radius r. */
export function hexPoints(r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`;
  }).join(' ');
}
