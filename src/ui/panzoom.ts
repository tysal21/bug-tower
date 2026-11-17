// Pan and zoom for the skill tree SVG: drag to move, mouse wheel or pinch to zoom, plus +/- buttons.
// The view lives outside the SVG (the menu re-renders its HTML on every click), so it survives renders.

export interface View { cx: number; cy: number; zoom: number } // zoom 1 = the whole tree fits

export const MIN_ZOOM = 1, MAX_ZOOM = 3.5;
const DRAG_PX = 6; // a press that moves less than this is still a tap

export function fitView(box: number[]): View {
  return { cx: box[0] + box[2] / 2, cy: box[1] + box[3] / 2, zoom: 1 };
}

export function panZoom(svg: SVGSVGElement, box: number[], view: View) {
  const [bx, by, bw, bh] = box;
  const apply = () => {
    view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));
    const w = bw / view.zoom, h = bh / view.zoom;
    // keep some of the tree on screen
    view.cx = Math.min(bx + bw - w / 2 + w * 0.3, Math.max(bx + w / 2 - w * 0.3, view.cx));
    view.cy = Math.min(by + bh - h / 2 + h * 0.3, Math.max(by + h / 2 - h * 0.3, view.cy));
    if (view.zoom === 1) { view.cx = bx + bw / 2; view.cy = by + bh / 2; }
    svg.setAttribute('viewBox', `${view.cx - w / 2} ${view.cy - h / 2} ${w} ${h}`);
    svg.classList.toggle('zoomed', view.zoom > 1);
  };
  /** Screen pixels -> SVG units. */
  const toSvg = (x: number, y: number) => {
    const m = svg.getScreenCTM();
    if (!m) return { x: view.cx, y: view.cy };
    const p = new DOMPoint(x, y).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const unitsPerPx = () => { const m = svg.getScreenCTM(); return m ? 1 / m.a : 0; };
  const zoomAt = (f: number, sx: number, sy: number) => {
    const p = toSvg(sx, sy), old = view.zoom;
    view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, old * f));
    const k = old / view.zoom;
    view.cx = p.x + (view.cx - p.x) * k;
    view.cy = p.y + (view.cy - p.y) * k;
    apply();
  };

  const pts = new Map<number, { x: number; y: number }>();
  let start: { x: number; y: number } | null = null, dragged = false, pinch = 0;

  svg.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { start = { x: e.clientX, y: e.clientY }; dragged = false; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); dragged = true; }
  });
  svg.addEventListener('pointermove', e => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pts.set(e.pointerId, cur);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = d;
      return;
    }
    if (!dragged && start && Math.hypot(cur.x - start.x, cur.y - start.y) > DRAG_PX) {
      dragged = true;
      svg.setPointerCapture(e.pointerId);
      svg.classList.add('dragging');
    }
    if (dragged) {
      const u = unitsPerPx();
      view.cx -= (cur.x - prev.x) * u;
      view.cy -= (cur.y - prev.y) * u;
      apply();
    }
  });
  const up = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = 0;
    if (!pts.size) svg.classList.remove('dragging');
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  // A drag must not count as a tap on the cell it started on.
  svg.addEventListener('click', e => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(Math.exp(-dy * 0.0015), e.clientX, e.clientY);
  }, { passive: false });

  apply();
  return {
    zoomBy(f: number) { const r = svg.getBoundingClientRect(); zoomAt(f, r.left + r.width / 2, r.top + r.height / 2); },
    reset() { Object.assign(view, fitView(box)); apply(); },
  };
}
