import "../index";

/**
 * Wireframe: a page laid out on a grid board, its parts cut as thin tiles: a
 * nav bar, a hero image, a column of text, three cards and a button. Each
 * tile floats over its own dashed slot, with dashed drops to it. The pointer
 * is a field: tiles near it lift off the board like components being picked
 * up, each on its own spring, falling off with distance. At rest the page is
 * slightly exploded and the button, where the eye should start, is bright.
 * The slider is the radius, in world units.
 */
const {
  Cam, extremes, facing, fit, poly, prism, proj, rings, ringAt, seg, unproj, spring, stepS,
  mk, pointer, put, register, disposer, solid,
} = HL;

const TH = 2.5, HMAX = 30, X1 = 96, Y1 = 114, PAD = 8;
// [name, x0, y0, x1, y1, rest lift, corner, kind]
const TILES = [
  ["nav", 0, 0, 96, 10, 3, 3, "nav"],
  ["hero", 0, 16, 60, 56, 7, 3, "image"],
  ["copy", 66, 16, 96, 56, 2, 3, "copy"],
  ["card 1", 0, 62, 28, 96, 4, 3, "card"],
  ["card 2", 34, 62, 62, 96, 2, 3, "card"],
  ["card 3", 68, 62, 96, 96, 5, 3, "card"],
  ["button", 34, 104, 62, 114, 12, 5, "button"],
];
const MARK = 6;

const falloff = (u) =>
  u <= 0 ? 1 : u <= 0.417 ? 1 - (u / 0.417) * 0.6875 : u <= 1 ? 0.3125 - ((u - 0.417) / 0.583) * 0.2185 : 0.094;

/** What a tile of each kind has on its face, as [dim, medium] path strings at height z. */
function face(P, t, z) {
  const [, x0, y0, x1, y1, , , kind] = t, s = (a, b, c, d) => seg(P(a, b, z), P(c, d, z));
  if (kind === "nav") {
    let lo = "";
    for (let k = 0; k < 4; k++) lo += s(x1 - 34 + k * 8, y0 + 5, x1 - 29 + k * 8, y0 + 5);
    return [lo, s(x0 + 4, y0 + 5, x0 + 16, y0 + 5)];
  }
  if (kind === "image") return [s(x0 + 5, y0 + 5, x1 - 5, y1 - 5) + s(x1 - 5, y0 + 5, x0 + 5, y1 - 5), ""];
  if (kind === "copy") {
    let lo = "";
    for (let k = 1; k < 6; k++) lo += s(x0 + 4, y0 + 5 + k * 5.5, x1 - (k === 5 ? 12 : 4), y0 + 5 + k * 5.5);
    return [lo, s(x0 + 4, y0 + 5, x1 - 8, y0 + 5)];
  }
  if (kind === "card") return [s(x0 + 3, y0 + 18, x1 - 3, y0 + 18) + s(x0 + 4, y0 + 28, x1 - 9, y0 + 28), s(x0 + 4, y0 + 23, x1 - 4, y0 + 23)];
  return ["", s(x0 + 9, (y0 + y1) / 2, x1 - 9, (y0 + y1) / 2)];
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.78);
  fit(C, [[-PAD, -PAD, -4], [X1 + PAD, Y1 + PAD, -4], [X1 + PAD, -PAD, -4], [-PAD, Y1 + PAD, -4], [0, 0, HMAX + TH], [X1, 0, HMAX + TH]], 200, 166);
  const P = proj(C), front = facing(C);
  let R = value, scr = null, lit = MARK;

  const g = mk("g", {}, svg);
  const [br, bi] = rings(-PAD, -PAD, X1 + PAD, Y1 + PAD, 7, 2.2);
  put(solid(g), prism(P, front, br, bi, -4, 0));

  const tiles = TILES.map((t, i) => {
    const [ring, inner] = rings(t[1], t[2], t[3], t[4], t[6], 1);
    return { t, i, ring, inner, rest: t[5], cx: (t[1] + t[3]) / 2, cy: (t[2] + t[4]) / 2, sp: spring(t[5], { eps: 0.04 }), drawn: NaN };
  });
  // Every slot is on the board, under every tile: guides first.
  for (const k of tiles) mk("path", { class: "nf dash", d: poly(ringAt(P, k.ring, 0)) }, g);
  // Back to front by x + y; a tile only rises away from the ones in front of it.
  for (const k of tiles.slice().sort((a, b) => a.cx + a.cy - (b.cx + b.cy))) {
    const grp = mk("g", {}, g);
    k.drops = mk("path", { class: "nf dash" }, grp);
    k.el = solid(grp);
    k.lo = mk("path", { class: "nf lo" }, grp);
    k.md = mk("path", { class: "nf" }, grp);
  }

  function draw(k) {
    const h = Math.max(0.5, k.sp.x);
    if (h === k.drawn) return;
    k.drawn = h;
    put(k.el, prism(P, front, k.ring, k.inner, h, h + TH));
    k.drops.setAttribute("d", extremes(P, k.ring).map((q) => seg(P(q.u, q.v, h), P(q.u, q.v, 0))).join(""));
    const [lo, md] = face(P, k.t, h + TH);
    k.lo.setAttribute("d", lo);
    k.md.setAttribute("d", md);
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const k of tiles) { if (stepS(k.sp, dt)) m = true; draw(k); }
    return m;
  });
  bag.add(B.unregister);

  /** How far the pointer is from tile k, on the plane of its resting top: it never moves. */
  function dist(k) {
    const [x, y] = unproj(C, scr[0], scr[1], k.rest + TH);
    return Math.hypot(Math.max(k.t[1] - x, 0, x - k.t[3]), Math.max(k.t[2] - y, 0, y - k.t[4]));
  }

  function retarget() {
    let best = MARK, bd = Infinity;
    for (const k of tiles) {
      if (!scr) { k.sp.t = k.rest; continue; }
      const d = dist(k);
      if (d < bd || (d === bd && k.cx + k.cy > tiles[best].cx + tiles[best].cy)) { bd = d; best = k.i; }
      k.sp.t = Math.max(k.rest, HMAX * falloff(d / R));
    }
    lit = best;
    for (const k of tiles) k.el.sil.classList.toggle("hi", k.i === lit);
    read.textContent = scr ? TILES[lit][0] : "rest";
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => { scr = p; retarget(); },
    leave: () => { scr = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());
  retarget();

  return {
    set: (v) => { R = v; if (scr) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "wireframe",
  means: "A page's layout as tiles on a grid: the parts near the pointer lift off their slots, the farther the less.",
  rules: [1, 3, 5, 6],
  range: [10, 22, 40],
  tour: [[204, 144], [268, 184], [135, 194], null],
  mount,
});
