/**
 * The PELAGOS wordmark that closes the page, drawn *in* the backdrop's wave
 * texture rather than on top of it: inside the letters the same ASCII current
 * just runs denser and brighter, with soft dithered edges. The word is
 * oversized so it bleeds past both sides of the viewport and runs off the
 * bottom of the page, cut just enough to stay readable.
 *
 * This module only rasterises the word into per-cell coverage (0..1) on the
 * backdrop's own grid; AsciiOcean renders the texture.
 */

export type Wordmark = {
  cols: number;
  rows: number;
  /** 0..1 share of each cell covered by a letter */
  cover: Float32Array;
};

/** How much wider than the viewport the word is set. */
const OVERSIZE = 1.05;
/** Share of the letters' height cut off by the bottom of the page. */
const SINK = 0.1;
/** Coverage is sampled on a SUB x SUB grid inside each cell. */
const SUB = 3;

export function buildWordmark(
  text: string,
  cols: number,
  cw: number,
  ch: number,
  family: string,
): Wordmark | null {
  const viewportW = cols * cw;
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe || viewportW < 10) return null;
  probe.font = `800 100px ${family}`;
  const m = probe.measureText(text);
  const size = (100 * viewportW * OVERSIZE) / m.width;
  const cap = (m.actualBoundingBoxAscent / 100) * size;
  const rows = Math.max(3, Math.ceil((cap * (1 - SINK)) / ch) + 1);

  const width = Math.round(viewportW);
  const height = rows * ch;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.font = `800 ${size}px ${family}`;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillStyle = "#fff";
  // baseline below the band, so the bottom SINK of the letters is cut off
  g.fillText(text, width / 2, height + cap * SINK);

  const px = g.getImageData(0, 0, width, height).data;
  const cover = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      for (let j = 0; j < SUB; j++) {
        for (let i = 0; i < SUB; i++) {
          const sx = Math.min(width - 1, Math.floor((x + (i + 0.5) / SUB) * cw));
          const sy = Math.min(height - 1, Math.floor((y + (j + 0.5) / SUB) * ch));
          sum += px[(sy * width + sx) * 4 + 3] / 255;
        }
      }
      cover[y * cols + x] = sum / (SUB * SUB);
    }
  }
  return { cols, rows, cover };
}
