import "../index";

/**
 * Hard Drive: an open hard-disk drive. A cast chassis with screws at its
 * corners, a stack of three platters on a spindle hub, and an actuator arm
 * pivoting from the near corner over a voice-coil magnet, its head over the
 * top platter. The pointer, read on the top platter's fixed plane, sets how
 * far from the spindle the head should be; the arm seeks there on a spring.
 * Tracks are dim rings on the top platter; the one under the head's target
 * is bright. At rest the arm is parked partway, over track 3. The slider is
 * the arm's spring stiffness.
 */
const {
  Cam, clamp, circ, facing, fit, hull, open, poly, prism, proj, ringAt, rings, run, unproj,
  spring, stepS, disposer, flatDot, mk, place, pointer, put, register, solid,
} = HL;

const R = 46, NT = 8, R0 = 42, STEP = 4, REST = 3, HUB = 9;
const PV = [74, 34], L = 70, ARM_Z = 24.5;
const BASE = 8, PZ = [[10, 11.5], [15.5, 17], [21, 22.5]], TOPZ = 22.5;
const trackR = (i) => R0 - i * STEP;
const D = Math.hypot(PV[0], PV[1]), BASE_A = Math.atan2(-PV[1], -PV[0]);

/** The arm's angle at the pivot that puts the head r from the spindle. */
const armAngle = (r) => BASE_A - Math.acos(clamp((L * L + D * D - r * r) / (2 * L * D), -1, 1));

/** A closed world polygon as a ring of samples, with outward normals, for facing/run. */
function asRing(pts) {
  const n = pts.length;
  let a = 0;
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; }
  const s = a > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const b = pts[(i - 1 + n) % n], f = pts[(i + 1) % n], tx = f[0] - b[0], ty = f[1] - b[1], m = Math.hypot(tx, ty) || 1;
    return { u: p[0], v: p[1], nu: (s * ty) / m, nv: (-s * tx) / m };
  });
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.55);
  const X0 = -54, Y0 = -54, X1 = 100, Y1 = 56;
  fit(C, [[X0, Y0, 0], [X1, Y1, 0], [X1, Y0, 0], [X0, Y1, 0], [X0, Y0, 30], [X1, Y0, 30], [X0, Y1, 30]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  // the chassis: a cast slab, screws at the corners and halfway along the long sides
  const [cr, ci] = rings(X0, Y0, X1, Y1, 10, 2);
  put(solid(g), prism(P, front, cr, ci, 0, BASE));
  for (const [x, y] of [[X0 + 6, Y0 + 6], [X1 - 6, Y0 + 6], [X0 + 6, Y1 - 6], [X1 - 6, Y1 - 6], [23, Y0 + 5], [23, Y1 - 5]])
    place(flatDot(g, C, 1.3, "dot off"), P(x, y, BASE));

  // the voice-coil magnet under the arm's tail, a rounded plate around where the tail can swing
  const tails = [trackR(0), trackR(NT - 1)].map((r) => { const a = armAngle(r) + Math.PI; return [PV[0] + 18 * Math.cos(a), PV[1] + 18 * Math.sin(a)]; });
  const mx0 = Math.min(tails[0][0], tails[1][0]) - 9, mx1 = Math.min(X1 - 4, Math.max(tails[0][0], tails[1][0]) + 9);
  const my0 = Math.min(tails[0][1], tails[1][1]) - 9, my1 = Math.min(Y1 - 4, Math.max(tails[0][1], tails[1][1]) + 9);

  // the platters, bottom to top, so each covers the one below; tracks ride the top one
  const disc = circ(R, 64), discIn = circ(R - 1.6, 64);
  PZ.forEach(([z0, z1]) => put(solid(g), prism(P, front, disc, discIn, z0, z1)));
  const tracks = [];
  for (let i = 0; i < NT; i++) tracks.push(mk("path", { d: poly(ringAt(P, circ(trackR(i), 48), TOPZ)), class: "nf lo" }, g));
  // the spindle hub and its clamp screws
  const [hr, hi] = [circ(HUB, 32), circ(HUB - 1.2, 32)];
  put(solid(g), prism(P, front, hr, hi, TOPZ, TOPZ + 4.5));
  for (let k = 0; k < 6; k++) place(flatDot(g, C, 0.9, "dot off"), P(5 * Math.cos(k * 1.047), 5 * Math.sin(k * 1.047), TOPZ + 4.5));

  const [mr, mi] = rings(mx0, my0, mx1, my1, 6, 1.5);
  put(solid(g), prism(P, front, mr, mi, BASE, BASE + 4));
  const [pr, pi] = rings(PV[0] - 6, PV[1] - 6, PV[0] + 6, PV[1] + 6, 6, 1.2);
  put(solid(g), prism(P, front, pr, pi, BASE, ARM_Z));

  // the arm: a tapered plate from a wide coil tail to the head, then the pivot cap over it
  const arm = solid(g), head = flatDot(g, C, 1.6, "dot m");
  const [kr, ki] = rings(PV[0] - 3.5, PV[1] - 3.5, PV[0] + 3.5, PV[1] + 3.5, 3.5, 1);
  put(solid(g), prism(P, front, kr, ki, ARM_Z + 1.8, ARM_Z + 3.5));

  let k = value, sp = spring(trackR(REST), { k, eps: 0.02 }), drawn = NaN, lit = -1;
  function drawArm(r) {
    if (r === drawn) return;
    drawn = r;
    const a = armAngle(r), c = Math.cos(a), s = Math.sin(a);
    const at = (u, v) => [PV[0] + u * c - v * s, PV[1] + u * s + v * c];
    const ring = asRing([at(-20, -9), at(L + 3, -2), at(L + 3, 2), at(-20, 9)]);
    put(arm, { sil: poly(hull(ringAt(P, ring, ARM_Z).concat(ringAt(P, ring, ARM_Z + 1.8)))), crease: open(ringAt(P, run(ring, front), ARM_Z + 1.8)) });
    place(head, P(PV[0] + L * c, PV[1] + L * s, TOPZ + 0.6));
  }
  function light(i) {
    if (i === lit) return;
    if (lit >= 0) tracks[lit].setAttribute("class", "nf lo");
    lit = i;
    tracks[i].setAttribute("class", "nf hi");
  }

  const B = register(stage, (dt) => { const m = stepS(sp, dt); drawArm(sp.x); return m; });
  bag.add(B.unregister);

  function aim(p) {
    const [x, y] = p ? unproj(C, p[0], p[1], TOPZ) : [0, 0], d = Math.hypot(x, y);
    if (!p || d > R + 8) { sp.t = trackR(REST); light(REST); read.textContent = "rest"; }
    else {
      sp.t = clamp(d, trackR(NT - 1), trackR(0));
      const i = clamp(Math.round((R0 - sp.t) / STEP), 0, NT - 1);
      light(i); read.textContent = `track ${i}`;
    }
    B.wake();
  }

  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());
  drawArm(sp.x); aim(null);

  return {
    set: (v) => { k = v; const t = sp.t, nsp = spring(sp.x, { k, eps: 0.02 }); nsp.t = t; sp = nsp; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "harddrive",
  means: "An open hard drive: the arm seeks the track at the pointer's distance from the spindle, on a spring.",
  rules: [1, 3, 5, 8],
  range: [40, 100, 250],
  tour: [[176, 112], [176, 131], [128, 167], null],
  mount,
});
