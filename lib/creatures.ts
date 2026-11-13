/**
 * Sea life seen from above, through the water.
 *
 * Each creature is a shape function: given a point (x, y) in its own
 * coordinate space, it answers which *part* of the animal is there (body,
 * flank, fin, eye…). The renderer samples that function once per character
 * cell and fills the cell with digits or hash marks depending on the part,
 * so every animal reads as a solid mass of data rather than line art.
 *
 * Units: 1 unit = one text row. x grows toward the head (every creature faces
 * right; the renderer mirrors it), y is the animal's left/right side, so
 * swimming shows up as a side-to-side body wave.
 */

export const PART = {
  EMPTY: 0,
  BODY: 1, // digits
  FLANK: 2, // light ':' shading toward the edges
  FIN: 3, // '+'
  EYE: 4, // solid blank
  LINE: 5, // faint digits: ridges, seams, scutes
  TENTACLE: 6, // ':' '|' '!'
} as const;

export type CreatureKind =
  | "shoal"
  | "fish"
  | "turtle"
  | "shark"
  | "jelly"
  | "octopus"
  | "manta"
  | "whale";

export type Member = { x: number; y: number; p: number };

/** What a shape function may read or cache about the animal it draws. */
export type ShapeState = {
  phase: number;
  members?: Member[];
  cache?: Float32Array;
};

export type Spec = {
  /** extent of the shape in its own units: [xMin, xMax, yMin, yMax] */
  bounds: [number, number, number, number];
  sample: (x: number, y: number, t: number, s: ShapeState) => number;
  /** once-per-frame work shared by every cell (e.g. arm curves) */
  prepare?: (t: number, s: ShapeState) => void;
  /** cruising speed, cells per second */
  speed: [number, number];
  parallax: [number, number];
  scale: [number, number];
  /** how hard it meanders, in radians per second of turn */
  agility: number;
  /** stroke frequency (rad/s) and how much each stroke surges it forward */
  beat: number;
  surge: number;
  /** how much the body curves into a turn (0 = rigid) */
  bend: number;
  /** general direction of travel; defaults to across the screen */
  rises?: boolean;
};

const { EMPTY, BODY, FLANK, FIN, EYE, LINE, TENTACLE } = PART;

// ── geometry helpers ───────────────────────────────────────────────────────

/** < 1 inside the ellipse */
const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy;
};

const tri = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
) => {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
};

/** Tapered paddle (flipper, pectoral fin) hinged at (ax, ay), pointing along `phi`. */
const limb = (
  x: number,
  y: number,
  ax: number,
  ay: number,
  phi: number,
  reach: number,
  width: number,
) => {
  const dx = x - ax;
  const dy = y - ay;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  if (lx < -0.2 || lx > reach) return false;
  const half = reach / 2;
  const w = width * (1.1 - 0.6 * (lx / reach));
  return ell(lx, ly, half, 0, half, w) < 1;
};

/** Half-width of a streamlined body at x: pointed tail, rounded head. */
const spindle = (x: number, x0: number, x1: number, r: number, peak: number, round: number) => {
  const u = (x - x0) / (x1 - x0);
  if (u <= 0 || u >= 1) return 0;
  const p = Math.log(0.5) / Math.log(peak);
  return r * Math.pow(Math.sin(Math.PI * Math.pow(u, p)), round);
};

/** Lateral swimming wave: grows from nothing at `still` to `amp` at the tail. */
const wave = (x: number, t: number, still: number, length: number, amp: number, speed: number, phase: number) => {
  const k = Math.max(0, (still - x) / length);
  return amp * k * k * Math.sin(x * 0.7 - t * speed + phase);
};

/** Edge shading: digits along the spine, lighter toward the flanks. */
const shade = (ay: number, r: number) => (ay > r * 0.62 ? FLANK : BODY);

// ── shapes (all viewed from above) ─────────────────────────────────────────

const tinyFish = (x: number, y: number, t: number, ph: number) => {
  y -= wave(x, t, 1, 4, 0.9, 11, ph);
  const ay = Math.abs(y);
  const r = spindle(x, -2.6, 3.0, 1.6, 0.6, 0.6);
  if (ay < r) return BODY;
  if (tri(x, ay, -2.2, 0, -4.0, 1.7, -3.5, 0)) return FIN;
  return EMPTY;
};

const fish: Spec["sample"] = (x, y, t, { phase }) => {
  y -= wave(x, t, 3, 9, 1.3, 7, phase);
  const ay = Math.abs(y);
  if (ell(x, ay, 3.4, 1.4, 0.38, 0.45) < 1) return EYE;
  const r = spindle(x, -4.6, 5.2, 2.3, 0.62, 0.6);
  if (ay < r) {
    if (ay < 0.3 && x > -3.4 && x < 2.8) return LINE; // dorsal ridge
    return shade(ay, r);
  }
  if (limb(x, ay, 2.1, 1.6, 2.35 + 0.35 * Math.sin(t * 5 + phase), 2.6, 0.7)) return FIN;
  if (tri(x, ay, -4.0, 0, -7.2, 3.0, -6.3, 0)) return FIN; // tail fan
  return EMPTY;
};

const turtle: Spec["sample"] = (x, y, t, { phase }) => {
  const sw = Math.sin(t * 2.1 + phase);
  const ay = Math.abs(y);
  if (ell(x, ay, 6.95, 0.62, 0.32, 0.36) < 1) return EYE;
  if (ell(x, y, 6.5, 0, 1.55, 1.05) < 1 || ell(x, y, 4.9, 0, 1.3, 0.8) < 1) return BODY;
  // shell with scutes
  if (ell(x, y, 0, 0, 5.2, 3.4) < 1) {
    const inner = ell(x, y, 0.2, 0, 3.2, 2.0);
    if (Math.abs(Math.sqrt(inner) - 1) < 0.11) return LINE;
    if (inner < 1) {
      if (Math.abs(x - 1.15) < 0.22 || Math.abs(x + 1.0) < 0.22) return LINE;
      return BODY;
    }
    const seg = Math.atan2(y / 3.4, x / 5.2) / (Math.PI / 4);
    if (Math.abs(seg - Math.round(seg)) < 0.08) return LINE;
    return BODY;
  }
  // flippers stroke together: big front pair, small rear pair
  if (limb(x, ay, 2.6, 2.6, 2.25 - 0.6 * sw, 3.9, 0.8)) return FIN;
  if (limb(x, ay, -3.9, 2.0, 2.65 - 0.25 * sw, 1.9, 0.6)) return FIN;
  if (tri(x, ay, -5, 0.4, -5, 0, -6.3, 0)) return FIN;
  return EMPTY;
};

const shark: Spec["sample"] = (x, y, t, { phase }) => {
  y -= wave(x, t, 2, 9, 1.1, 4, phase);
  const ay = Math.abs(y);
  if (ell(x, ay, 5.6, 1.0, 0.3, 0.32) < 1) return EYE;
  const r = spindle(x, -6.8, 7.6, 1.75, 0.5, 0.7);
  if (ay < r) {
    if (ell(x, y, 0.4, 0, 1.7, 0.36) < 1) return LINE; // dorsal fin from above
    if (ay < 0.3 && x > -6 && x < 4.5) return LINE;
    return shade(ay, r);
  }
  if (tri(x, ay, 3.2, 1.0, -0.6, 1.0, -2.0, 4.9)) return FIN; // pectorals
  if (tri(x, ay, -3.2, 0.7, -4.1, 0.8, -4.6, 1.9)) return FIN; // pelvics
  if (tri(x, ay, -6.0, 0.8, -6.0, 0, -10, 0)) return FIN; // tail
  return EMPTY;
};

const whale: Spec["sample"] = (x, y, t, { phase }) => {
  y -= wave(x, t, -1, 11, 0.7, 1.4, phase);
  const ay = Math.abs(y);
  if (ell(x, ay, 8.6, 0.35, 0.32, 0.22) < 1) return EYE; // blowholes
  const r = spindle(x, -8.8, 12, 2.7, 0.62, 0.5);
  if (ay < r) {
    if (ell(x, y, -4, 0, 1.1, 0.3) < 1) return LINE; // dorsal knob
    // pale mottling along the back
    if (Math.sin(x * 1.7) * Math.sin(y * 2.3 + x) > 0.7) return FLANK;
    return shade(ay, r);
  }
  if (limb(x, ay, 5.4, 2.2, 2.0 - 0.2 * Math.sin(t * 0.9 + phase), 5.6, 0.7)) return FIN;
  // flukes spread sideways; they pitch with each beat, so their span breathes
  const span = 4.4 * (0.78 + 0.22 * Math.cos(t * 1.4 + phase));
  if (tri(x, ay, -8.2, 0, -12.6, span, -11.2, 0) && ell(x, ay, -12.9, 0, 1.4, 0.9) >= 1) return FIN;
  return EMPTY;
};

const jelly: Spec["sample"] = (x, y, t, { phase }) => {
  const p = 1 + 0.12 * Math.sin(t * 2.6 + phase);
  const R = 3.4 * p;
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  if (r < R) {
    // four-leaf gonads in the middle, radial canals, frilled margin
    if (r < 1.5 * (0.55 + 0.45 * Math.abs(Math.cos(2 * a + phase)))) return BODY;
    const seg = (a + phase) / (Math.PI / 4);
    if (Math.abs(seg - Math.round(seg)) * r < 0.3) return LINE;
    if (r > R * 0.86) return FIN;
    return FLANK;
  }
  // tentacles trail out from the rim and curl with the pulse
  const L = 3.6;
  if (r < R + L) {
    const d = r - R;
    for (let i = 0; i < 8; i++) {
      const ai = phase + (i * Math.PI) / 4 + 0.28 * Math.sin(t * 2 + i) * d;
      let da = a - ai;
      da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
      if (Math.abs(da) * r < 0.42 && d < L - (i % 3) * 0.7) return TENTACLE;
    }
  }
  return EMPTY;
};

// Octopus arm curves are shared by every cell, so build them once a frame.
const ARMS = 8;
const ARM_STEPS = 14;
const ARM_LEN = 6.4;

const octopusPrepare: Spec["prepare"] = (t, s) => {
  s.cache ??= new Float32Array(ARMS * ARM_STEPS * 3);
  const c = s.cache;
  for (let i = 0; i < ARMS; i++) {
    const spread = (i / (ARMS - 1)) * 2 - 1;
    let ang = Math.PI + spread * 1.35;
    let px = -0.2;
    let py = spread * 0.6;
    const step = ARM_LEN / ARM_STEPS;
    for (let k = 0; k < ARM_STEPS; k++) {
      const sLen = k * step;
      ang += 0.16 * Math.sin(sLen * 0.7 - t * 2.6 + i * 1.3 + s.phase);
      px += Math.cos(ang) * step;
      py += Math.sin(ang) * step;
      const o = (i * ARM_STEPS + k) * 3;
      c[o] = px;
      c[o + 1] = py;
      c[o + 2] = 0.8 * (1 - sLen / ARM_LEN) + 0.42; // taper
    }
  }
};

const octopus: Spec["sample"] = (x, y, t, { cache }) => {
  const ay = Math.abs(y);
  if (ell(x, ay, 0.5, 1.15, 0.38, 0.4) < 1) return EYE;
  const mantle = ell(x, y, 2.0, 0, 2.7 + 0.15 * Math.sin(t * 1.8), 1.9);
  if (mantle < 1) return mantle > 0.6 ? FLANK : BODY;
  if (ell(x, y, 0.1, 0, 1.4, 1.5) < 1) return BODY;
  if (!cache) return EMPTY;
  for (let i = 0; i < ARMS * ARM_STEPS; i++) {
    const o = i * 3;
    const dx = x - cache[o];
    const dy = y - cache[o + 1];
    const w = cache[o + 2];
    if (dx * dx + dy * dy < w * w) {
      const k = i % ARM_STEPS;
      return k < 4 ? BODY : k < 11 ? FIN : TENTACLE;
    }
  }
  return EMPTY;
};

const manta: Spec["sample"] = (x, y, t, { phase }) => {
  const flap = Math.cos(t * 1.5 + phase);
  const span = 7.2 * (0.74 + 0.26 * flap);
  const ay = Math.abs(y);
  if (x < -2.5 && x > -9 && ay < 0.45) return TENTACLE;
  if (ell(x, ay, 3.7, 1.0, 0.85, 0.36) < 1) return FIN;
  if (ay < span) {
    const lead = 3.2 - 4.0 * Math.pow(ay / span, 1.3);
    const trail = ay < 1.2 ? -2.8 : -2.8 + 2.2 * ((ay - 1.2) / (span - 1.2));
    if (x < lead && x > trail) {
      if (ell(x, ay, 0.9, 2.6, 1.1, 1.3) < 1) return FLANK; // shoulder patches
      if (ay < 0.3 && x > -2.4 && x < 2.2) return LINE;
      return BODY;
    }
  }
  return EMPTY;
};

const shoal: Spec["sample"] = (x, y, t, { members }) => {
  for (const m of members ?? []) {
    const mx = m.x + 0.9 * Math.sin(t * 0.7 + m.p);
    const my = m.y + 0.6 * Math.sin(t * 0.9 + m.p * 2);
    const p = tinyFish(x - mx, y - my, t, m.p);
    if (p) return p;
  }
  return EMPTY;
};

export const SPECS: Record<CreatureKind, Spec> = {
  shoal: {
    bounds: [-5, 20, -3, 10],
    sample: shoal,
    speed: [7, 10],
    parallax: [0.9, 1.25],
    scale: [1, 1],
    agility: 0.8,
    beat: 9,
    surge: 0.15,
    bend: 0,
  },
  fish: {
    bounds: [-7.4, 5.4, -4.6, 4.6],
    sample: fish,
    speed: [4, 7],
    parallax: [0.6, 1.05],
    scale: [1, 1.3],
    agility: 1.0,
    beat: 7,
    surge: 0.25,
    bend: 1,
  },
  turtle: {
    bounds: [-6.6, 8.2, -7.4, 7.4],
    sample: turtle,
    speed: [2.5, 4],
    parallax: [0.55, 0.9],
    scale: [1, 1.2],
    agility: 0.35,
    beat: 2.1,
    surge: 0.4,
    bend: 0.3,
  },
  shark: {
    bounds: [-10.2, 7.8, -5.4, 5.4],
    sample: shark,
    speed: [4, 7],
    parallax: [0.5, 0.85],
    scale: [1.1, 1.4],
    agility: 0.5,
    beat: 4,
    surge: 0.15,
    bend: 1,
  },
  jelly: {
    bounds: [-7.4, 7.4, -7.4, 7.4],
    sample: jelly,
    speed: [2, 3.5],
    parallax: [0.55, 1.05],
    scale: [0.9, 1.2],
    agility: 0.25,
    beat: 2.6,
    surge: 0.8,
    bend: 0,
    rises: true,
  },
  octopus: {
    bounds: [-8.4, 4.9, -7.2, 7.2],
    sample: octopus,
    prepare: octopusPrepare,
    speed: [1.5, 2.8],
    parallax: [0.5, 0.85],
    scale: [1, 1.3],
    agility: 0.6,
    beat: 2.6,
    surge: 0.6,
    bend: 0.5,
  },
  manta: {
    bounds: [-9.2, 4.7, -7.9, 7.9],
    sample: manta,
    speed: [2, 3.5],
    parallax: [0.45, 0.75],
    scale: [1, 1.3],
    agility: 0.35,
    beat: 1.5,
    surge: 0.3,
    bend: 0.3,
  },
  whale: {
    bounds: [-13, 12.2, -8.2, 8.2],
    sample: whale,
    speed: [1.4, 2.2],
    parallax: [0.35, 0.5],
    scale: [1, 1.2],
    agility: 0.15,
    beat: 1.4,
    surge: 0.2,
    bend: 0.6,
  },
};

/** Scatter the members of a shoal so no two fish overlap. */
export const makeShoal = (): Member[] => {
  const n = 4 + Math.floor(Math.random() * 5);
  const out: Member[] = [];
  for (let tries = 0; out.length < n && tries < 300; tries++) {
    const m = { x: Math.random() * 15.4, y: Math.random() * 7, p: Math.random() * 6.28 };
    if (out.every((o) => Math.abs(o.x - m.x) > 7.6 || Math.abs(o.y - m.y) > 3.6)) out.push(m);
  }
  return out;
};
