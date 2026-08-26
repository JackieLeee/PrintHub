/** Simplified CODE39-style bars for preview (not for production scanning). */
export function drawBarcodePreview(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  maxWidth: number,
  height: number,
  data: string,
  hri: "none" | "above" | "below" | "both",
  color = "#111111",
): number {
  const quiet = 8;
  const bars: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    bars.push(1, 1, code % 2 === 0 ? 2 : 1, 1, 2, code % 3 === 0 ? 2 : 1);
  }
  const totalUnits = bars.reduce((a, b) => a + b, 0);
  const unit = Math.max(1, Math.floor((maxWidth - quiet * 2) / totalUnits));

  let cx = x + quiet;
  ctx.fillStyle = color;

  for (let i = 0; i < bars.length; i++) {
    const w = bars[i]! * unit;
    if (i % 2 === 0) ctx.fillRect(cx, y, w, height);
    cx += w;
  }

  const usedHeight = height + (hri === "none" ? 0 : 16);
  if (hri === "above" || hri === "both") {
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(data, x + maxWidth / 2, y - 4);
  }
  if (hri === "below" || hri === "both") {
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(data, x + maxWidth / 2, y + height + 14);
  }

  return usedHeight + (hri === "both" ? 16 : 0);
}

/** Deterministic QR-like grid preview from payload (visual only). */
export function drawQrPreview(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  data: string,
  color = "#111111",
): number {
  const modules = 21 + (Math.min(6, Math.floor(data.length / 16)) % 4) * 4;
  const cell = Math.max(2, Math.floor(size / modules));
  const dim = modules * cell;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, dim, dim);
  ctx.fillStyle = color;

  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      const inFinder =
        (row < 7 && col < 7) ||
        (row < 7 && col >= modules - 7) ||
        (row >= modules - 7 && col < 7);
      const finderOn =
        inFinder &&
        (row === 0 ||
          row === 6 ||
          col === 0 ||
          col === 6 ||
          (row >= 2 && row <= 4 && col >= 2 && col <= 4) ||
          (row < 7 && col >= modules - 7 && (col === modules - 7 || col === modules - 1 || (row >= 2 && row <= 4 && col >= modules - 5 && col <= modules - 3))) ||
          (row >= modules - 7 && col < 7 && (row === modules - 7 || row === modules - 1 || (row >= modules - 5 && row <= modules - 3 && col >= 2 && col <= 4))));

      hash = Math.imul(hash ^ (row * modules + col), 2246822519);
      const on = inFinder ? finderOn : (hash & 1) === 1;
      if (on) ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
    }
  }

  return dim + 8;
}
