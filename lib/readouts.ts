/**
 * Live ASCII readouts for the platform section. Each factory returns a
 * stateful `frame(seconds) => string` that renders one screen of a fixed-size
 * monospace "instrument". They are plain functions so the component can write
 * the result straight into a <pre> without re-rendering React.
 */

export const READOUT_COLS = 58;
export const READOUT_ROWS = 17;

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));

/** Write `text` into `line` starting at `at`, clipped to the line. */
const overlay = (line: string[], at: number, text: string) => {
  for (let i = 0; i < text.length; i++) {
    const x = at + i;
    if (x >= 0 && x < line.length) line[x] = text[i];
  }
};

// ── ECHO: spectrogram with labelled calls ──────────────────────────────────

const ECHO_RAMP = " .:-=+*#%@";
const ECHO_CALLS = [
  ["HUMPBACK", "song unit"],
  ["BLUE WHALE", "D-call"],
  ["ORCA", "pulsed call"],
  ["SPERM WHALE", "coda"],
] as const;

export function echoReadout() {
  const gutter = 6;
  const width = READOUT_COLS - gutter;
  const bands = READOUT_ROWS - 4; // label row, time axis, status row, spacer
  const perSecond = 14;
  const columns: Float32Array[] = [];
  const labels: { at: number; text: string }[] = [];
  let produced = 0;
  let callStart = -10;
  let callLen = 0;
  let callBase = 0;
  let clicksUntil = -1;
  let detections = 0;
  let current = "";

  const column = (n: number) => {
    const t = n / perSecond;
    const col = new Float32Array(bands);
    for (let r = 0; r < bands; r++) {
      col[r] = 0.05 + Math.random() * 0.14;
      // ship noise rumbles along the bottom bands
      if (r >= bands - 2) col[r] += 0.3 + Math.random() * 0.25;
    }
    // a new call every few seconds
    if (t - callStart > callLen + 1.2 + Math.random() * 0.4) {
      callStart = t;
      callLen = 1.6 + Math.random() * 1.4;
      callBase = 4 + Math.random() * (bands - 8);
      const [name, kind] = pick(ECHO_CALLS);
      const p = (0.9 + Math.random() * 0.09).toFixed(2);
      current = `${name} ${kind}`;
      labels.push({ at: n, text: `v ${name} p=${p}` });
      detections++;
    }
    const u = (t - callStart) / callLen;
    if (u >= 0 && u <= 1) {
      // up-sweep then fall, with a harmonic above it
      const f = callBase + 3.2 * Math.sin(Math.PI * u) * (u < 0.5 ? 1 : 0.8);
      for (let r = 0; r < bands; r++) {
        const d = Math.abs(r - (bands - 1 - f));
        const h = Math.abs(r - (bands - 1 - f * 1.6));
        col[r] += Math.max(0, 0.95 - d * 0.55) + Math.max(0, 0.5 - h * 0.5);
      }
    }
    // dolphin echolocation: short broadband click trains
    if (clicksUntil < t && Math.random() < 0.012) clicksUntil = t + 0.4;
    if (t < clicksUntil && n % 2 === 0) {
      for (let r = 0; r < bands - 3; r++) col[r] += 0.45 + Math.random() * 0.2;
    }
    return col;
  };

  return (seconds: number) => {
    const target = Math.floor(seconds * perSecond);
    if (produced === 0) {
      // start with a full screen of history
      for (let i = 0; i < width; i++) columns.push(column(produced++));
    }
    while (produced < target + width) {
      columns.push(column(produced++));
      if (columns.length > width) columns.shift();
    }
    const first = produced - columns.length;
    while (labels.length && labels[0].at < first - 24) labels.shift();

    const out: string[] = [];
    const top = Array<string>(READOUT_COLS).fill(" ");
    for (const l of labels) overlay(top, gutter + l.at - first, l.text);
    out.push(top.join(""));
    for (let r = 0; r < bands; r++) {
      const axis = r === 0 ? "48kHz|" : r === Math.floor(bands / 2) ? "24kHz|" : r === bands - 1 ? " 0kHz|" : "     |";
      let row = axis;
      for (const col of columns) {
        const v = Math.min(0.999, col[r]);
        row += ECHO_RAMP[Math.floor(v * ECHO_RAMP.length)];
      }
      out.push(row);
    }
    let axis = "     +";
    for (let i = 0; i < width; i++) axis += (first + i) % perSecond === 0 ? "+" : "-";
    out.push(axis);
    out.push("");
    out.push(pad(` LISTENING  ${current || "..."}`, 36) + `CALLS ${String(detections).padStart(4, "0")}`.padStart(READOUT_COLS - 36));
    return out.join("\n");
  };
}

// ── REEFSIGHT: scanning a reef map ─────────────────────────────────────────

export function reefReadout() {
  const rows = READOUT_ROWS - 3;
  const cols = READOUT_COLS;
  const sweep = 6.5;
  const hold = 2.2;
  let cycle = -1;
  let grid: string[][] = [];
  let box = { x0: 0, x1: 0, y0: 0, y1: 0 };
  let cover = 0;
  let bleached = 0;

  const build = () => {
    const ph = Array.from({ length: 6 }, () => Math.random() * 6.28);
    const bx = 8 + Math.random() * (cols - 16);
    const by = 3 + Math.random() * (rows - 6);
    grid = [];
    let coral = 0;
    let white = 0;
    box = { x0: cols, x1: 0, y0: rows, y1: 0 };
    for (let y = 0; y < rows; y++) {
      const line: string[] = [];
      for (let x = 0; x < cols; x++) {
        const v =
          (Math.sin(x * 0.21 + ph[0]) + Math.sin(y * 0.55 + ph[1]) + Math.sin((x * 0.13 + y * 0.4) + ph[2]) +
            Math.sin(x * 0.07 - y * 0.3 + ph[3])) /
            4 +
          0.5;
        let ch = ".";
        if (v > 0.62) {
          coral++;
          const inPatch = ((x - bx) / 7) ** 2 + ((y - by) / 2.6) ** 2 < 1;
          if (inPatch) {
            ch = "o";
            white++;
            box.x0 = Math.min(box.x0, x);
            box.x1 = Math.max(box.x1, x);
            box.y0 = Math.min(box.y0, y);
            box.y1 = Math.max(box.y1, y);
          } else ch = (x * 7 + y * 3) % 5 === 0 ? "%" : "#";
        } else if (v > 0.48) ch = ":";
        else if (Math.random() < 0.08) ch = ",";
        line.push(ch);
      }
      grid.push(line);
    }
    cover = (coral / (rows * cols)) * 100;
    bleached = coral ? (white / coral) * 100 : 0;
  };

  return (seconds: number) => {
    const n = Math.floor(seconds / (sweep + hold));
    if (n !== cycle) {
      cycle = n;
      build();
    }
    const local = seconds - n * (sweep + hold);
    const scan = Math.min(cols, Math.floor((local / sweep) * cols));
    const out: string[] = [];
    const found = box.x1 >= box.x0 && scan > box.x1;
    for (let y = 0; y < rows; y++) {
      const line: string[] = [];
      for (let x = 0; x < cols; x++) {
        if (x < scan) line.push(grid[y][x]);
        else if (x === scan) line.push("|");
        else line.push(Math.random() < 0.55 ? String(Math.floor(Math.random() * 10)) : " ");
      }
      if (found) {
        const { x0, x1, y0, y1 } = box;
        const left = Math.max(0, x0 - 2);
        const right = Math.min(cols - 1, x1 + 2);
        if (y === y0 - 1 || y === y1 + 1) for (let x = left; x <= right; x++) line[x] = x === left || x === right ? "+" : "-";
        if (y >= y0 && y <= y1) {
          line[left] = "|";
          line[right] = "|";
        }
      }
      out.push(line.join(""));
    }
    if (found) {
      const tag = ` BLEACHING ${(bleached / 100).toFixed(2)} `;
      const row = Math.max(0, box.y0 - 1);
      const line = out[row].split("");
      overlay(line, Math.max(0, Math.min(cols - tag.length, box.x0 - 1)), tag);
      out[row] = line.join("");
    }
    out.push("-".repeat(cols));
    const pct = Math.round((scan / cols) * 100);
    out.push(
      pad(` COVER ${cover.toFixed(1)}%   BLEACHED ${found ? bleached.toFixed(1) : "--.-"}%`, 40) +
        `SCAN ${String(pct).padStart(3)}%`.padStart(cols - 40),
    );
    out.push(pad(" LEGEND  # coral   o bleached   : rubble   . sand", cols));
    return out.join("\n");
  };
}

// ── STRAND: eDNA reads assigned to species ─────────────────────────────────

const TAXA = [
  "T.albacares",
  "M.novaeangliae",
  "C.mydas",
  "Acropora sp.",
  "E.encrasicolus",
  "P.macrocephalus",
  "M.birostris",
  "O.vulgaris",
] as const;

export function strandReadout() {
  const rows = READOUT_ROWS - 3;
  const seqLen = 24;
  const typeSpeed = 70;
  const every = 0.75;
  type Read = { id: number; seq: string; hit: number; result: string; born: number };
  const reads: Read[] = [];
  let made = 0;
  let total = 12408;
  const seen = new Set<string>();
  let novel = 2;

  const newRead = (born: number): Read => {
    const id = total++;
    let seq = "";
    for (let i = 0; i < seqLen; i++) seq += "acgt"[Math.floor(Math.random() * 4)];
    const roll = Math.random();
    let hit = -1;
    let result = "  unassigned";
    if (roll < 0.72) {
      hit = Math.floor(Math.random() * (seqLen - 10));
      const taxon = pick(TAXA);
      seen.add(taxon);
      result = `> ${taxon} ${(95 + Math.random() * 4.9).toFixed(1)}%`;
    } else if (roll < 0.76) {
      hit = Math.floor(Math.random() * (seqLen - 10));
      novel++;
      result = "! NOVEL candidate";
    }
    return { id, seq, hit, result, born };
  };

  return (seconds: number) => {
    if (made === 0) {
      for (let i = rows - 2; i > 0; i--) reads.push(newRead(seconds - i * every - 5));
      made = 1;
    }
    while (reads[reads.length - 1].born + every <= seconds) reads.push(newRead(reads[reads.length - 1].born + every));
    while (reads.length > rows - 1) reads.shift();

    const out: string[] = [pad(" READ    SEQUENCE                  ASSIGNMENT", READOUT_COLS)];
    for (const r of reads) {
      const typed = Math.min(seqLen, Math.floor((seconds - r.born) * typeSpeed));
      let seq = "";
      for (let i = 0; i < seqLen; i++) {
        if (i >= typed) seq += i === typed ? "_" : " ";
        else if (r.hit >= 0 && typed === seqLen && i >= r.hit && i < r.hit + 10) seq += r.seq[i].toUpperCase();
        else seq += r.seq[i];
      }
      const result = typed === seqLen ? r.result : "  ...";
      out.push(pad(` R${String(r.id).slice(-5)}  ${seq}  ${result}`, READOUT_COLS));
    }
    while (out.length < rows) out.push("");
    out.push("-".repeat(READOUT_COLS));
    out.push(
      pad(` READS ${total.toLocaleString("en-US")}   TAXA ${String(29 + seen.size)}   NOVEL ${novel}`, 44) +
        "12S/COI".padStart(READOUT_COLS - 44),
    );
    out.push(pad(" UPPERCASE = barcode region matched to reference", READOUT_COLS));
    return out.join("\n");
  };
}
