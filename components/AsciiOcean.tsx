"use client";

import { useEffect, useRef } from "react";
import { PART, SPECS, makeShoal, type CreatureKind, type ShapeState } from "@/lib/creatures";
import { buildWordmark, type Wordmark } from "@/lib/wordmark";

/**
 * Full-viewport ASCII ocean rendered on a fixed canvas behind the page,
 * looking straight down into the water.
 *
 * - The white "sunlit" zone ends at the bottom of `#hero`; everything below
 *   is solid blue. The boundary is a dithered, undulating ASCII shoreline
 *   that travels with the page, so scrolling literally dives under it.
 * - Creatures are filled silhouettes (see lib/creatures.ts): digits for the
 *   body mass, '#' for the outline, ':' for pale flanks. Each one steers along
 *   its own meandering heading, rotates to face it, curves its body into
 *   turns and surges with each stroke.
 * - Text stays readable: behind every block of copy the water clears and any
 *   creature passing underneath fades to a faint ghost.
 * - Scroll velocity feeds an `energy` value. Energy floods the field with
 *   digits, speeds the current, startles the creatures and releases bubbles.
 * - On load the field starts fully flooded and drains away while a turtle and
 *   shoals cross the hero (the intro sequence).
 */

const BLUE = "#0b33ff";
const WHITE = "#ffffff";
/** Waves below the shoreline: a deep navy that reads as shadow in the blue */
const DEEP_INK = "#061c96";

const RAMP = ".,:;~=+*#";
const DITHER = ":.";
const SPACE = 32;
const HASH = 35;

/** Elements whose text the backdrop must stay out of. */
const READABLE =
  "main h1, main h2, main h3, main p, main blockquote, main a, main nav, main li, main dd, main footer span, [data-veil]";

type Creature = ShapeState & {
  id: number;
  kind: CreatureKind;
  scale: number;
  /** position of the creature's origin, in columns / rows */
  x: number;
  y: number;
  /** direction of travel in screen space, radians (y points down) */
  heading: number;
  /** where it is generally headed; it meanders around this */
  goal: number;
  /** current turn rate, rad/s */
  turn: number;
  speed: number;
  parallax: number;
  /** fainter = further below the surface */
  far: boolean;
  clock: number;
  age: number;
  seen: boolean;
  /** furthest extent from the origin, in shape units (already scaled) */
  radius: number;
  grid: Uint8Array;
  seeds: Uint16Array;
};

type Bubble = { x: number; y: number; vy: number; phase: number; ch: number };

const hash = (a: number, b: number, c: number) => {
  let h =
    (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 362437)) |
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Signed shortest angle from a to b. */
const angleTo = (a: number, b: number) => {
  let d = b - a;
  d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  return d;
};

const ZONES: [number, string][] = [
  [200, "SUNLIGHT ZONE"],
  [1000, "TWILIGHT ZONE"],
  [4000, "MIDNIGHT ZONE"],
  [6000, "ABYSSAL ZONE"],
  [Infinity, "HADAL ZONE"],
];

const TENTACLE_GLYPHS = [58, 124, 33, 58]; // : | ! :

// glyph layers, each drawn in the light zone (blue) and the deep zone (white)
const L_FIELD = 0;
const L_SOLID = 1;
const L_FAINT = 2;
const L_GHOST = 3;
const L_WORD = 4;
const LAYERS = 5;

export default function AsciiOcean() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let cols = 0;
    let rows = 0;
    let cw = 8;
    let ch = 18;
    /** cell width / cell height: converts columns into shape units */
    let aspect = 0.45;
    let sizeFactor = 1;
    let fontPx = 13;
    let font = "";
    let field = new Uint16Array(0);
    let fg = new Uint16Array(0);
    let fgFaint = new Uint8Array(0);
    let veil = new Uint8Array(0);
    let boundary = new Int16Array(0);
    let rowSin = new Float32Array(0);
    let colSin = new Float32Array(0);
    let bufs: Uint16Array[] = [];
    let wordmark: Wordmark | null = null;
    let wordCell = new Uint8Array(0);
    /** 0..1, eases up while the cursor is over the wordmark */
    // ripple surface (wave equation on the cell grid), disturbed by the cursor
    let ripple = new Float32Array(0);
    let rippleWas = new Float32Array(0);
    let rippleDebt = 0;
    let lastPointer: { x: number; y: number } | null = null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fontPx = W < 640 ? 11 : 13;
      font = `500 ${fontPx}px ${getComputedStyle(canvas).fontFamily}`;
      ctx.font = font;
      cw = ctx.measureText("0".repeat(50)).width / 50;
      ch = Math.round(fontPx * 1.4);
      aspect = cw / ch;
      cols = Math.ceil(W / cw) + 1;
      rows = Math.ceil(H / ch) + 1;
      sizeFactor = Math.min(1.4, Math.max(0.75, cols / 140));
      field = new Uint16Array(cols * rows);
      fg = new Uint16Array(cols * rows);
      fgFaint = new Uint8Array(cols * rows);
      wordCell = new Uint8Array(cols * rows);
      veil = new Uint8Array(cols * rows);
      boundary = new Int16Array(cols);
      rowSin = new Float32Array(rows);
      colSin = new Float32Array(cols);
      bufs = Array.from({ length: LAYERS * 2 }, () => new Uint16Array(cols));
      ripple = new Float32Array(cols * rows);
      rippleWas = new Float32Array(cols * rows);
      wordmark = buildWordmark("PELAGOS", cols, cw, ch, getComputedStyle(document.body).fontFamily);
    };

    resize();
    window.addEventListener("resize", resize);
    document.fonts?.ready.then(resize);

    // cursor position in px; moving it stirs ripples into the water
    let pointer: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      pointer = null;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    const hero = document.getElementById("hero");
    const seabed = document.getElementById("seabed");
    const readable = Array.from(document.querySelectorAll<HTMLElement>(READABLE));

    let creatures: Creature[] = [];
    let bubbles: Bubble[] = [];
    let energy = 0;
    let T = 0;
    let lastScroll = window.scrollY;
    let last = performance.now();
    const t0 = last;
    let bubbleDebt = 0;
    let nextId = 1;

    const makeCreature = (kind: CreatureKind, scale?: number): Creature => {
      const spec = SPECS[kind];
      const parallax = rand(spec.parallax[0], spec.parallax[1]);
      const s =
        kind === "shoal"
          ? Math.max(0.85, Math.min(1, sizeFactor))
          : (scale ?? rand(spec.scale[0], spec.scale[1]) * sizeFactor);
      const [x0, x1, y0, y1] = spec.bounds;
      const radius = Math.max(Math.hypot(x0, y0), Math.hypot(x0, y1), Math.hypot(x1, y0), Math.hypot(x1, y1)) * s;
      return {
        id: nextId++,
        kind,
        scale: s,
        x: 0,
        y: 0,
        heading: 0,
        goal: 0,
        turn: 0,
        speed: rand(spec.speed[0], spec.speed[1]),
        parallax,
        far: parallax < 0.62,
        phase: Math.random() * Math.PI * 2,
        clock: Math.random() * 10,
        age: 0,
        seen: false,
        radius,
        members: kind === "shoal" ? makeShoal() : undefined,
        grid: new Uint8Array(0),
        seeds: new Uint16Array(0),
      };
    };

    const pickKind = (depth: number): CreatureKind => {
      const table: [CreatureKind, number][] =
        depth < 0.3
          ? [["shoal", 4], ["fish", 4], ["turtle", 2]]
          : depth < 0.65
            ? [["jelly", 3], ["shark", 2], ["manta", 2], ["fish", 2], ["shoal", 1], ["turtle", 1]]
            : [["octopus", 3], ["jelly", 3], ["whale", 2], ["manta", 1]];
      const total = table.reduce((s, [, w]) => s + w, 0);
      let roll = Math.random() * total;
      for (const [kind, w] of table) {
        roll -= w;
        if (roll <= 0) {
          if (kind === "whale" && (cols < 90 || creatures.some((c) => c.kind === "whale")))
            return "jelly";
          return kind;
        }
      }
      return "shoal";
    };

    /** Place a newcomer just outside an edge, aimed across the screen at an angle. */
    const spawn = (depth: number, from: "side" | "top" | "bottom") => {
      const kind = pickKind(depth);
      const c = makeCreature(kind);
      const rx = c.radius / aspect;
      const ry = c.radius;
      if (SPECS[kind].rises) {
        c.goal = -Math.PI / 2 + rand(-0.5, 0.5);
        c.x = rand(cols * 0.1, cols * 0.9);
        c.y = from === "top" ? -ry * 0.6 : rows + ry * 0.6;
      } else {
        const right = Math.random() < 0.5;
        c.goal = (right ? 0 : Math.PI) + rand(-0.6, 0.6);
        if (from === "side") {
          c.x = right ? -rx * 0.7 : cols + rx * 0.7;
          c.y = rand(rows * 0.1, rows * 0.9);
        } else {
          c.x = rand(cols * 0.15, cols * 0.85);
          c.y = from === "top" ? -ry * 0.7 : rows + ry * 0.7;
        }
      }
      c.heading = c.goal + rand(-0.4, 0.4);
      creatures.push(c);
    };

    // Intro cast: a big turtle glides up into the hero on a long curve,
    // two shoals and a fish follow it in at their own angles.
    if (!reduce) {
      const lead = makeCreature("turtle", 1.25 * sizeFactor);
      const span = cols + (2 * lead.radius) / aspect;
      lead.speed = span / 7;
      lead.x = -lead.radius / aspect * 0.35;
      lead.y = rows * 0.4;
      lead.heading = -0.32;
      lead.goal = 0.12;
      lead.far = false;
      const s1 = makeCreature("shoal");
      s1.x = -s1.radius / aspect - cols * 0.05;
      s1.y = rows * 0.55;
      s1.heading = -0.35;
      s1.goal = 0.1;
      s1.speed = lead.speed * 1.5;
      const s2 = makeCreature("shoal");
      s2.x = -s2.radius / aspect - cols * 0.25;
      s2.y = rows * 0.05;
      s2.heading = 0.35;
      s2.goal = 0.05;
      s2.speed = lead.speed * 1.6;
      const f = makeCreature("fish");
      f.x = cols + f.radius / aspect + cols * 0.1;
      f.y = rows * 0.15;
      f.heading = Math.PI - 0.3;
      f.goal = Math.PI + 0.15;
      f.speed = lead.speed * 1.4;
      creatures.push(lead, s1, s2, f);
    }

    const put = (col: number, row: number, code: number, faint = 0) => {
      if (col < 0 || row < 0 || col >= cols || row >= rows) return;
      const i = row * cols + col;
      fg[i] = code;
      fgFaint[i] = faint;
    };

    const text = (col: number, row: number, s: string) => {
      for (let i = 0; i < s.length; i++) put(col + i, row, s.charCodeAt(i));
    };

    /**
     * Mark the cells behind the copy. Body text (paragraphs, quotes, list
     * items) clears its whole block, so a paragraph reads on calm water like
     * the hero does; headings and links are traced line by line around the
     * text itself. Both keep a one-cell margin.
     */
    const range = document.createRange();
    const BLOCK = new Set(["P", "BLOCKQUOTE", "LI", "DD"]);
    const buildVeil = () => {
      veil.fill(0);
      for (const el of readable) {
        const box = el.getBoundingClientRect();
        if (box.bottom < 0 || box.top > H || box.width === 0) continue;
        let rects: Iterable<DOMRect>;
        if (BLOCK.has(el.tagName) || el.dataset.veil === "block") rects = [box];
        else {
          range.selectNodeContents(el);
          rects = range.getClientRects();
        }
        for (const r of rects) {
          if (r.width < 1 || r.bottom < 0 || r.top > H) continue;
          const c0 = Math.max(0, Math.floor(r.left / cw) - 1);
          const c1 = Math.min(cols - 1, Math.ceil(r.right / cw));
          const r0 = Math.max(0, Math.floor((r.top + 2) / ch));
          const r1 = Math.min(rows - 1, Math.floor((r.bottom - 2) / ch));
          for (let row = r0; row <= r1; row++) veil.fill(1, row * cols + c0, row * cols + c1 + 1);
        }
      }
    };

    /** Rotate the creature to its heading, sample its shape, stamp glyphs. */
    const drawCreature = (c: Creature) => {
      const spec = SPECS[c.kind];
      const rx = c.radius / aspect;
      const ry = c.radius;
      const colA = Math.max(0, Math.floor(c.x - rx));
      const colB = Math.min(cols - 1, Math.ceil(c.x + rx));
      const rowA = Math.max(0, Math.floor(c.y - ry));
      const rowB = Math.min(rows - 1, Math.ceil(c.y + ry));
      if (colA > colB || rowA > rowB) return;
      const w = colB - colA + 1;
      const h = rowB - rowA + 1;
      if (c.grid.length < w * h) {
        const size = Math.ceil(w * h * 1.3);
        c.grid = new Uint8Array(size);
        c.seeds = new Uint16Array(size);
      }
      const grid = c.grid;
      const seeds = c.seeds;

      const t = c.clock;
      spec.prepare?.(t, c);
      const cos = Math.cos(c.heading);
      const sin = Math.sin(c.heading);
      const inv = 1 / c.scale;
      // a turning body curves around the inside of the turn
      const bend = spec.bend * 0.045 * c.turn;
      // looking through moving water: the image ripples slightly
      const ripple = reduce ? 0 : 0.12 + 0.35 * energy;
      for (let i = 0; i < h; i++) {
        const dy = rowA + i + 0.5 - c.y;
        const wy = Math.sin((rowA + i) * 0.5 + T * 2.2 + c.id) * ripple;
        for (let j = 0; j < w; j++) {
          const dx = (colA + j + 0.5 - c.x) * aspect;
          const lx = (dx * cos + dy * sin) * inv;
          let ly = (-dx * sin + dy * cos) * inv;
          ly -= bend * lx * lx;
          const k = i * w + j;
          grid[k] = spec.sample(lx + wy, ly, t, c);
          // digit seed fixed to the animal's body, so digits ride along with it
          seeds[k] = (Math.round(lx * 2.2) * 37 + Math.round(ly) * 101) & 0xffff;
        }
      }

      const tick = T * 6;
      const faint = c.far ? 1 : 0;
      for (let i = 0; i < h; i++) {
        const row = rowA + i;
        for (let j = 0; j < w; j++) {
          const k = i * w + j;
          const p = grid[k];
          if (p === PART.EMPTY) continue;
          const col = colA + j;
          if (p === PART.EYE) {
            put(col, row, SPACE);
            continue;
          }
          const outline =
            (p === PART.BODY || p === PART.FLANK || p === PART.FIN) &&
            ((j > 0 && grid[k - 1] === PART.EMPTY) ||
              (j < w - 1 && grid[k + 1] === PART.EMPTY) ||
              (i > 0 && grid[k - w] === PART.EMPTY) ||
              (i < h - 1 && grid[k + w] === PART.EMPTY));
          if (outline) {
            put(col, row, HASH, faint);
            continue;
          }
          const seed = seeds[k];
          switch (p) {
            case PART.BODY: {
              // digits that slowly re-roll, staggered per cell
              const r = hash(seed, c.id, Math.floor(tick + (seed % 10) / 10));
              put(col, row, 48 + (r % 10), faint);
              break;
            }
            case PART.FLANK:
              put(col, row, hash(seed, c.id, 0) % 3 === 0 ? 46 : 58, 1);
              break;
            case PART.FIN:
              put(col, row, 43, faint);
              break;
            case PART.LINE:
              // seams and ridges: the same digit mass, just fainter
              put(col, row, 48 + (hash(seed, c.id, Math.floor(tick)) % 10), 1);
              break;
            case PART.TENTACLE:
              put(col, row, TENTACLE_GLYPHS[(seed + Math.floor(tick / 3)) & 3], 1);
              break;
          }
        }
      }
    };

    /**
     * Advance the ripple surface at a fixed 60 Hz. The cursor pushes the water
     * down along its path (harder the faster it moves); waves spread, interfere
     * and lose energy, so the surface settles back to calm within seconds.
     */
    const RIPPLE_HZ = 60;
    const DAMPING = 0.935;
    const stepRipples = (dt: number) => {
      if (reduce || !ripple.length) return;
      if (pointer && lastPointer) {
        const x0 = lastPointer.x / cw;
        const y0 = lastPointer.y / ch;
        const x1 = pointer.x / cw;
        const y1 = pointer.y / ch;
        const dist = Math.hypot((x1 - x0) * aspect, y1 - y0);
        if (dist > 0.05) {
          const force = Math.min(2, 0.6 + dist * 0.45);
          const steps = Math.min(40, Math.ceil(dist * 2));
          for (let s = 0; s <= steps; s++) {
            const u = s / steps;
            const cx = Math.round(x0 + (x1 - x0) * u);
            const cy = Math.round(y0 + (y1 - y0) * u);
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++) {
                const px = cx + dx;
                const py = cy + dy;
                if (px < 1 || py < 1 || px >= cols - 1 || py >= rows - 1) continue;
                const fall = 1 - (Math.abs(dx) / 2 + Math.abs(dy) / 2) * 0.5;
                ripple[py * cols + px] -= (force * fall) / steps;
              }
          }
        }
      }
      lastPointer = pointer ? { x: pointer.x, y: pointer.y } : null;

      rippleDebt += dt * RIPPLE_HZ;
      let n = 0;
      while (rippleDebt >= 1 && n++ < 3) {
        rippleDebt -= 1;
        // classic two-buffer wave step; the result overwrites the older buffer
        for (let r = 1; r < rows - 1; r++) {
          const off = r * cols;
          for (let c = 1; c < cols - 1; c++) {
            const k = off + c;
            const next =
              (ripple[k - 1] + ripple[k + 1] + ripple[k - cols] + ripple[k + cols]) * 0.5 - rippleWas[k];
            rippleWas[k] = next * DAMPING;
          }
        }
        const swap = ripple;
        ripple = rippleWas;
        rippleWas = swap;
      }
      if (rippleDebt > 3) rippleDebt = 0;
    };

    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (dt <= 0 || cols === 0) return;

      // ── scroll → energy ────────────────────────────────────────────────
      const scrollY = window.scrollY;
      const dScroll = scrollY - lastScroll;
      lastScroll = scrollY;
      const dRows = dScroll / ch;
      const target = Math.min(1, Math.abs(dScroll) / dt / 1500);
      const rate = target > energy ? 12 : 1.5;
      energy += (target - energy) * (1 - Math.exp(-dt * rate));

      const introT = (now - t0) / 1000;
      const drain = reduce ? 0 : Math.max(0, 1 - introT / 1.7);
      const flood = drain * drain;
      const E = Math.min(1, Math.max(energy * (reduce ? 0.3 : 1), flood));
      T += dt * (0.45 + 3.2 * E) * (reduce ? 0.4 : 1);

      const docH = document.documentElement.scrollHeight;
      const depth = Math.min(1, Math.max(0, scrollY / Math.max(1, docH - H)));
      const heroBottom = hero ? hero.getBoundingClientRect().bottom : H;
      const floorPx = seabed ? seabed.getBoundingClientRect().bottom : docH - scrollY;

      buildVeil();

      // ── shoreline between the white and blue zones ─────────────────────
      const amp = 0.6 + 1.8 * energy;
      const baseRow = heroBottom / ch;
      for (let c = 0; c < cols; c++) {
        boundary[c] = Math.round(
          baseRow +
            amp * (Math.sin(c * 0.09 + T * 1.1) * 0.6 + Math.sin(c * 0.031 - T * 0.7) * 0.9),
        );
      }

      // ── current field ──────────────────────────────────────────────────
      const drift = (scrollY / ch) * 0.5;
      const driftRow = Math.floor(drift);
      // sparse at rest, floods in as energy rises
      const threshold = 0.78 - 0.46 * E;
      const span = 1 - threshold;
      const digitChance = (0.1 + 0.9 * E) * 255;
      const tick = Math.floor(T * 5);
      for (let c = 0; c < cols; c++) colSin[c] = Math.sin(c * 0.066 + T * 0.2) * 1.8;
      for (let r = 0; r < rows; r++) rowSin[r] = Math.sin((r + drift) * 0.19 - T * 0.4) * 1.4;
      // ── ripples: the cursor disturbs the water ─────────────────────────
      stepRipples(dt);

      // the PELAGOS wordmark: the same current, denser and brighter inside
      // the letters, with dithered edges; cut by the bottom of the page
      wordCell.fill(0);
      const markTop = wordmark ? Math.floor(floorPx / ch) - wordmark.rows : Infinity;
      for (let r = 0; r < rows; r++) {
        const off = r * cols;
        const markRow = wordmark && r >= markTop && r < markTop + wordmark.rows ? r - markTop : -1;
        for (let c = 0; c < cols; c++) {
          // the ripple surface refracts whatever lies beneath it
          const k0 = off + c;
          const left = c > 0 ? ripple[k0 - 1] : 0;
          const right = c < cols - 1 ? ripple[k0 + 1] : 0;
          const up = r > 0 ? ripple[k0 - cols] : 0;
          const down = r < rows - 1 ? ripple[k0 + cols] : 0;
          const bendX = (right - left) * 0.9;
          const bendY = (down - up) * 0.5;
          const swirl = Math.min(0.1, Math.abs(ripple[k0]) * 0.02);
          const x = (c + bendX) * 0.11;
          const y = (r + drift + bendY) * 0.21;
          const n =
            Math.sin(x * 1.3 + T * 0.6 + rowSin[r]) +
            Math.sin(y * 1.7 - T * 0.5 + colSin[c]) +
            Math.sin((x + y) * 0.7 + T * 0.3);
          // ripple rings churn up extra texture as they pass
          const v = Math.min(1, (n + 3) / 6 + swirl);
          if (markRow >= 0) {
            // letters are read through the moving surface, so they warp and
            // then resolve as the water settles
            const sc = Math.round(c + bendX * 0.7);
            const sr = Math.round(markRow + bendY * 0.7);
            const cover =
              sc >= 0 && sc < cols && sr >= 0 && sr < wordmark!.rows ? wordmark!.cover[sr * cols + sc] : 0;
            if (cover > 0) {
              // long, slow swells roll through the letters; the glyph follows
              // the swell height, so the word moves like water instead of
              // flickering cell by cell
              const swell = Math.min(
                1,
                0.5 +
                  0.32 * Math.sin(c * 0.16 + markRow * 0.42 - T * 1.5) +
                  0.18 * Math.sin(c * 0.05 - markRow * 0.2 - T * 0.7 + v * 2) +
                  swirl,
              );
              // the stroke core is always filled; edges breathe with the swell
              const grain = (hash(c, markRow, 7) & 255) / 255;
              if (cover > 0.6 || grain < cover * (0.55 + 0.6 * swell)) {
                wordCell[off + c] = 1;
                const k = Math.max(0, Math.min(RAMP.length - 1, 2 + Math.floor(swell * (RAMP.length - 2))));
                field[off + c] = RAMP.charCodeAt(k);
                continue;
              }
            }
          }
          // around the letters the water stays calmer, so the word stands out
          // inside the wordmark band the water thins right out so the word reads
          const calm = markRow >= 0 ? Math.min(0.99, threshold + 0.3) : threshold;
          if (v < calm) {
            field[off + c] = SPACE;
            continue;
          }
          const h = hash(c, r + driftRow, tick);
          if ((h & 255) < digitChance) {
            // decimal in the light, binary in the deep
            field[off + c] = 48 + (r >= boundary[c] ? (h >>> 8) & 1 : (h >>> 8) % 10);
          } else {
            const i = Math.min(RAMP.length - 1, Math.floor(((v - threshold) / span) * RAMP.length));
            field[off + c] = RAMP.charCodeAt(i);
          }
        }
      }

      fg.fill(0);
      fgFaint.fill(0);

      // a light, sparse dither just above the shoreline; it thins out with
      // height and only gets busier while the page is being scrolled
      const keep = 0.35 + 0.45 * energy;
      for (let c = 0; c < cols; c++) {
        const b = boundary[c];
        if (b <= 0 || b - DITHER.length >= rows) continue;
        for (let d = 1; d <= DITHER.length; d++) {
          const roll = (hash(c, d, Math.floor(T * 2)) & 255) / 255;
          if (roll > keep / d) continue;
          put(c, b - d, DITHER.charCodeAt(d - 1), 1);
        }
      }

      // ── creatures: steer, swim, then draw far ones first ───────────────
      const dart = 1 + 2.6 * energy;
      const slow = reduce ? 0.4 : 1;
      const next: Creature[] = [];
      for (const c of creatures) {
        const spec = SPECS[c.kind];
        c.age += dt;
        c.clock += dt * slow * (1 + 1.2 * energy);
        // meander around the goal heading; scroll energy makes it skittish
        const wander =
          spec.agility *
          (Math.sin(c.clock * 0.37 + c.phase) * 0.8 + Math.sin(c.clock * 0.93 + c.phase * 2) * 0.5) *
          (1 + 1.5 * energy);
        const want = angleTo(c.heading, c.goal) * 0.5 + wander;
        c.turn += (want - c.turn) * (1 - Math.exp(-dt * 2));
        c.heading += c.turn * dt * slow;
        // each stroke surges it forward
        const surge = 1 + spec.surge * Math.sin(c.clock * spec.beat + c.phase);
        const v = c.speed * Math.max(0.15, surge) * dart * slow;
        c.x += Math.cos(c.heading) * v * dt;
        c.y += Math.sin(c.heading) * v * aspect * dt - dRows * c.parallax;

        const rx = c.radius / aspect + 3;
        const ry = c.radius + 3;
        if (c.x > 0 && c.x < cols && c.y > 0 && c.y < rows) c.seen = true;
        const gone = c.x < -rx || c.x > cols + rx || c.y < -ry || c.y > rows + ry;
        if (gone && (c.seen || c.age > 30)) {
          // scrolled out: bring a newcomer in from the incoming edge
          if (energy > 0.04 && (c.y < -ry || c.y > rows + ry)) spawn(depth, c.y < 0 ? "bottom" : "top");
          continue;
        }
        next.push(c);
      }
      creatures = next;
      creatures.sort((a, b) => a.parallax - b.parallax);
      for (const c of creatures) drawCreature(c);

      const cap = Math.max(3, Math.min(9, Math.round((cols * rows) / 1800)));
      const wanted = reduce ? cap : Math.min(cap, Math.floor((introT - 2.5) * 1.5));
      if (creatures.length < wanted && Math.random() < dt * 3) spawn(depth, "side");

      // ── bubbles ────────────────────────────────────────────────────────
      bubbleDebt += dt * (0.8 + 70 * energy);
      while (bubbleDebt >= 1 && bubbles.length < 260) {
        bubbleDebt -= 1;
        bubbles.push({
          x: rand(0, cols),
          y: dScroll < 0 ? rand(0, rows) : rows + rand(0, 6),
          vy: rand(4, 11),
          phase: Math.random() * 6.28,
          ch: "oO.o*"[Math.floor(Math.random() * 5)].charCodeAt(0),
        });
      }
      if (bubbleDebt > 1) bubbleDebt = 0;
      bubbles = bubbles.filter((b) => {
        b.y -= b.vy * dt + dRows * 1.35;
        b.phase += dt * 3;
        if (b.y < -2 || b.y > rows + 8) return false;
        put(Math.round(b.x + Math.sin(b.phase) * 0.8), Math.round(b.y), b.ch);
        return true;
      });

      // ── instrument readout ─────────────────────────────────────────────
      // only once the viewer has dived below the hero, so it never sits on the CTAs
      const readoutRow = Math.floor(H / ch) - 2;
      // hidden while the wordmark is on screen: it would sit on the letters
      if (heroBottom < H * 0.55 && markTop > readoutRow) {
        const metres = Math.round(10935 * Math.pow(depth, 2.1));
        const zone = ZONES.find(([limit]) => metres < limit)![1];
        const left = ` DEPTH ${String(metres).padStart(5, "0")} M  /  ${zone} `;
        text(2, readoutRow, left);
        if (cols > 90) {
          const bars = Math.round(energy * 12);
          const right = ` CURRENT [${"|".repeat(bars)}${".".repeat(12 - bars)}] `;
          text(Math.floor(W / cw) - right.length - 2, readoutRow, right);
        }
      }

      // ── paint ──────────────────────────────────────────────────────────
      ctx.globalAlpha = 1;
      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = BLUE;
      let runStart = 0;
      for (let c = 1; c <= cols; c++) {
        if (c < cols && boundary[c] === boundary[runStart]) continue;
        const top = Math.max(0, boundary[runStart] * ch);
        if (top < H) ctx.fillRect(runStart * cw, top, (c - runStart) * cw + 0.5, H - top);
        runStart = c;
      }

      ctx.font = font;
      ctx.textBaseline = "top";
      const pad = (ch - fontPx) / 2;
      // pass index = layer * 2 + (deep ? 1 : 0)
      const passes: { y: number; s: string }[][] = Array.from({ length: LAYERS * 2 }, () => []);
      for (let r = 0; r < rows; r++) {
        const off = r * cols;
        let used = 0;
        for (const b of bufs) b.fill(SPACE);
        for (let c = 0; c < cols; c++) {
          const i = off + c;
          const deep = r >= boundary[c] ? 1 : 0;
          // the wordmark has priority: its letters always win over creatures,
          // bubbles and readouts, and anything else in its band is a ghost
          if (wordCell[i]) {
            const p = L_WORD * 2 + deep;
            bufs[p][c] = field[i];
            used |= 1 << p;
            continue;
          }
          const top = fg[i];
          if (top) {
            if (top === SPACE) continue;
            // behind copy, everything drops to a ghost (the readout excepted)
            const inBand = r >= markTop;
            const layer = (veil[i] && r !== readoutRow) || inBand ? L_GHOST : fgFaint[i] ? L_FAINT : L_SOLID;
            const p = layer * 2 + deep;
            bufs[p][c] = top;
            used |= 1 << p;
          } else if (field[i] !== SPACE && !veil[i]) {
            const p = L_FIELD * 2 + deep;
            bufs[p][c] = field[i];
            used |= 1 << p;
          }
        }
        for (let p = 0; p < LAYERS * 2; p++) {
          if (used & (1 << p))
            passes[p].push({
              y: r * ch + pad,
              s: String.fromCharCode.apply(null, bufs[p] as unknown as number[]),
            });
        }
      }
      const styles: [string, number][] = [
        [BLUE, 0.16 + 0.45 * E],
        [DEEP_INK, 0.4 + 0.55 * E],
        [BLUE, 0.78],
        [WHITE, 0.82],
        [BLUE, 0.4],
        [WHITE, 0.45],
        [BLUE, 0.12],
        [WHITE, 0.16],
        [BLUE, 0.82 + 0.15 * E],
        [WHITE, 0.86 + 0.14 * E],
      ];
      for (let p = 0; p < LAYERS * 2; p++) {
        ctx.fillStyle = styles[p][0];
        ctx.globalAlpha = styles[p][1];
        for (const line of passes[p]) ctx.fillText(line.s, 0, line.y);
      }
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full font-mono"
    />
  );
}
