/** Code 128 bar/space widths per symbol (6 bars + 5 spaces = 11 modules). */
const CODE128_PATTERNS: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const STOP = 106;

function code128BValue(char: string): number {
  const code = char.charCodeAt(0);
  if (code < 32 || code > 127) return 0;
  return code - 32;
}

/** Encode ASCII payload to Code 128 symbol indices (set B). */
export function encodeCode128B(data: string): number[] {
  const codes = [START_B];
  for (const ch of data) codes.push(code128BValue(ch));
  let checksum = START_B;
  for (let i = 1; i < codes.length; i++) checksum += codes[i]! * i;
  codes.push(checksum % 103);
  codes.push(STOP);
  return codes;
}

/** Total barcode width in dots (narrow = module width). */
export function code128WidthDots(data: string, narrow: number): number {
  const codes = encodeCode128B(data);
  let modules = 0;
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code]!;
    for (const ch of pattern) modules += Number(ch);
  }
  return modules * narrow;
}

/** Draw Code 128 bars; returns total height consumed (bars + optional HRI). */
export function drawCode128(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  data: string,
  height: number,
  narrow: number,
  color: string,
  hri: "none" | "above" | "below",
): number {
  const codes = encodeCode128B(data);
  let cursor = x;
  ctx.fillStyle = color;

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code]!;
    let isBar = true;
    for (const ch of pattern) {
      const w = Number(ch) * narrow;
      if (isBar) ctx.fillRect(cursor, y, w, height);
      cursor += w;
      isBar = !isBar;
    }
  }

  const hriSize = Math.max(10, Math.round(narrow * 3));
  if (hri !== "none") {
    ctx.font = `${hriSize}px "Courier New", Courier, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = hri === "above" ? "bottom" : "top";
    const hy = hri === "above" ? y - 2 : y + height + 2;
    ctx.fillText(data, x + (cursor - x) / 2, hy);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    return height + hriSize + 4;
  }

  return height;
}
