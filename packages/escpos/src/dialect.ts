/** ESC/POS stream dialect — Epson-standard vs Star extensions. */
export type EscPosDialect = "standard" | "star";

/**
 * Heuristic dialect detection for ESC/POS byte streams.
 * Star printers often use ESC * column bitmaps, ESC i/m cuts, and ESC GS … sequences.
 */
export function detectEscPosDialect(payload: Uint8Array): EscPosDialect {
  if (payload.length === 0) return "standard";

  let score = 0;
  let hasEscStar = false;
  let hasEscGs = false;
  let hasGsVCut = false;
  let hasEscStarCut = false;

  for (let i = 0; i < payload.length - 1; i++) {
    const b0 = payload[i]!;
    const b1 = payload[i + 1]!;

    if (b0 === 0x1b && b1 === 0x2a) {
      hasEscStar = true;
      score += 3;
    }
    if (b0 === 0x1b && b1 === 0x1d) {
      hasEscGs = true;
      score += 2;
    }
    if (b0 === 0x1d && b1 === 0x56) hasGsVCut = true;
    if (b0 === 0x1b && b1 === 0x69 && i + 2 >= payload.length) {
      hasEscStarCut = true;
      score += 1;
    }
    if (b0 === 0x1b && b1 === 0x6d) score += 1;
  }

  if (hasEscGs) return "star";
  if (hasEscStar && (hasEscStarCut || !hasGsVCut)) return "star";
  if (score >= 3) return "star";
  return "standard";
}
