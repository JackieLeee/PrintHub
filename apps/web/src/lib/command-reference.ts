/** Command dialect for ESC/POS entries; TSPL commands use `standard` (TSC spec). */
export type CommandDialect = "standard" | "star" | "common";

export interface CommandEntry {
  name: string;
  syntax: string;
  descriptionKey: string;
  dialect: CommandDialect;
}

export interface CommandCategory {
  titleKey: string;
  commandNames: string[];
}

export const TSPL_CATEGORIES: CommandCategory[] = [
  {
    titleKey: "labelSetup",
    commandNames: ["SIZE", "GAP", "BLINE", "DIRECTION", "REFERENCE", "OFFSET", "SHIFT"],
  },
  {
    titleKey: "contentGraphics",
    commandNames: [
      "CLS",
      "TEXT",
      "BLOCK",
      "BARCODE",
      "QRCODE",
      "BITMAP",
      "BOX",
      "BAR",
      "REVERSE",
      "CIRCLE",
      "ELLIPSE",
      "PUTBMP",
      "PUTPCX",
    ],
  },
  { titleKey: "printControl", commandNames: ["PRINT", "DENSITY", "SPEED", "FEED", "BACKFEED", "HOME"] },
  {
    titleKey: "hardwareOptions",
    commandNames: ["SET PEEL", "SET TEAR", "SET CUTTER", "CODEPAGE", "SELFTEST"],
  },
];

export const ESCPOS_CATEGORIES: CommandCategory[] = [
  {
    titleKey: "initFeed",
    commandNames: ["init", "feedLines", "feedDots", "lineSpacingDefault", "lineSpacingSet"],
  },
  { titleKey: "textStyle", commandNames: ["align", "bold", "underline", "charSize", "invert"] },
  {
    titleKey: "barcodeImage",
    commandNames: ["barHeight", "barWidth", "hriPos", "printBarcode", "qr2d", "rasterImage"],
  },
  {
    titleKey: "deviceControl",
    commandNames: ["cutPaper", "cashDrawer", "gsCharTable", "gsPrintDensity"],
  },
  {
    titleKey: "starExtensions",
    commandNames: [
      "bitmapMode",
      "cutPaperLegacy",
      "cutPaperPartial",
      "starPrintMode",
      "starEscGsE",
      "starEscGsI",
    ],
  },
];

export const TSPL_COMMANDS: CommandEntry[] = [
  { name: "SIZE", syntax: 'SIZE w mm, h mm', descriptionKey: "size", dialect: "standard" },
  { name: "GAP", syntax: "GAP m mm, n mm", descriptionKey: "gap", dialect: "standard" },
  { name: "BLINE", syntax: "BLINE m mm, n mm", descriptionKey: "bline", dialect: "standard" },
  { name: "DIRECTION", syntax: "DIRECTION 0|1", descriptionKey: "direction", dialect: "standard" },
  { name: "REFERENCE", syntax: "REFERENCE x, y", descriptionKey: "reference", dialect: "standard" },
  { name: "OFFSET", syntax: "OFFSET n mm", descriptionKey: "offset", dialect: "standard" },
  { name: "SHIFT", syntax: "SHIFT n", descriptionKey: "shift", dialect: "standard" },
  { name: "CLS", syntax: "CLS", descriptionKey: "cls", dialect: "standard" },
  { name: "TEXT", syntax: 'TEXT x,y,"font",rot,xmul,ymul,"text"', descriptionKey: "text", dialect: "standard" },
  {
    name: "BLOCK",
    syntax: 'BLOCK x,y,w,h,"font",rot,xmul,ymul,"text"',
    descriptionKey: "block",
    dialect: "standard",
  },
  {
    name: "BARCODE",
    syntax: 'BARCODE x,y,"type",h,read,rot,n,w,"data"',
    descriptionKey: "barcode",
    dialect: "standard",
  },
  { name: "QRCODE", syntax: 'QRCODE x,y,ECC,cell,mode,rot,"data"', descriptionKey: "qrcode", dialect: "standard" },
  { name: "BITMAP", syntax: "BITMAP x,y,w,h,mode,data", descriptionKey: "bitmap", dialect: "standard" },
  { name: "BOX", syntax: "BOX x1,y1,x2,y2,thickness[,radius]", descriptionKey: "box", dialect: "standard" },
  { name: "BAR", syntax: "BAR x,y,width,height", descriptionKey: "bar", dialect: "standard" },
  { name: "REVERSE", syntax: "REVERSE x,y,width,height", descriptionKey: "reverse", dialect: "standard" },
  { name: "CIRCLE", syntax: "CIRCLE x,y,diameter,thickness", descriptionKey: "circle", dialect: "standard" },
  { name: "ELLIPSE", syntax: "ELLIPSE x,y,w,h,thickness", descriptionKey: "ellipse", dialect: "standard" },
  { name: "PUTBMP", syntax: 'PUTBMP x,"file.bmp"', descriptionKey: "putbmp", dialect: "standard" },
  { name: "PUTPCX", syntax: 'PUTPCX x,"file.pcx"', descriptionKey: "putpcx", dialect: "standard" },
  { name: "PRINT", syntax: "PRINT m[,n]", descriptionKey: "print", dialect: "standard" },
  { name: "DENSITY", syntax: "DENSITY 0~15", descriptionKey: "density", dialect: "standard" },
  { name: "SPEED", syntax: "SPEED n", descriptionKey: "speed", dialect: "standard" },
  { name: "FEED", syntax: "FEED n", descriptionKey: "feed", dialect: "standard" },
  { name: "BACKFEED", syntax: "BACKFEED n", descriptionKey: "backfeed", dialect: "standard" },
  { name: "HOME", syntax: "HOME", descriptionKey: "home", dialect: "standard" },
  { name: "SET PEEL", syntax: "SET PEEL ON|OFF", descriptionKey: "setPeel", dialect: "standard" },
  { name: "SET TEAR", syntax: "SET TEAR ON|OFF", descriptionKey: "setTear", dialect: "standard" },
  { name: "SET CUTTER", syntax: "SET CUTTER ON|OFF", descriptionKey: "setCutter", dialect: "standard" },
  { name: "CODEPAGE", syntax: "CODEPAGE n", descriptionKey: "codepage", dialect: "standard" },
  { name: "SELFTEST", syntax: "SELFTEST", descriptionKey: "selftest", dialect: "standard" },
];

export const ESCPOS_COMMANDS: CommandEntry[] = [
  { name: "init", syntax: String.raw`\x1B\x40`, descriptionKey: "init", dialect: "common" },
  { name: "align", syntax: String.raw`\x1B\x61 n`, descriptionKey: "align", dialect: "common" },
  { name: "bold", syntax: String.raw`\x1B\x45 n`, descriptionKey: "bold", dialect: "common" },
  { name: "underline", syntax: String.raw`\x1B\x2D n`, descriptionKey: "underline", dialect: "common" },
  { name: "feedLines", syntax: String.raw`\x1B\x64 n`, descriptionKey: "feedLines", dialect: "common" },
  { name: "feedDots", syntax: String.raw`\x1B\x4A n`, descriptionKey: "feedDots", dialect: "common" },
  {
    name: "lineSpacingDefault",
    syntax: String.raw`\x1B\x32`,
    descriptionKey: "lineSpacingDefault",
    dialect: "common",
  },
  { name: "lineSpacingSet", syntax: String.raw`\x1B\x33 n`, descriptionKey: "lineSpacingSet", dialect: "common" },
  { name: "charSize", syntax: String.raw`\x1D\x21 n`, descriptionKey: "charSize", dialect: "common" },
  { name: "invert", syntax: String.raw`\x1D\x42 n`, descriptionKey: "invert", dialect: "common" },
  { name: "cutPaper", syntax: String.raw`\x1D\x56 m`, descriptionKey: "cutPaper", dialect: "standard" },
  { name: "barHeight", syntax: String.raw`\x1D\x68 n`, descriptionKey: "barHeight", dialect: "common" },
  { name: "barWidth", syntax: String.raw`\x1D\x77 n`, descriptionKey: "barWidth", dialect: "common" },
  { name: "hriPos", syntax: String.raw`\x1D\x48 n`, descriptionKey: "hriPos", dialect: "common" },
  { name: "printBarcode", syntax: String.raw`\x1D\x6B m ...`, descriptionKey: "printBarcode", dialect: "common" },
  { name: "qr2d", syntax: String.raw`\x1D\x28\x6B`, descriptionKey: "qr2d", dialect: "common" },
  { name: "rasterImage", syntax: String.raw`\x1D\x76\x30`, descriptionKey: "rasterImage", dialect: "standard" },
  { name: "bitmapMode", syntax: String.raw`\x1B\x2A m nL nH`, descriptionKey: "bitmapMode", dialect: "star" },
  { name: "cutPaperLegacy", syntax: String.raw`\x1B\x69`, descriptionKey: "cutPaperLegacy", dialect: "star" },
  { name: "cutPaperPartial", syntax: String.raw`\x1B\x6D`, descriptionKey: "cutPaperPartial", dialect: "star" },
  { name: "starPrintMode", syntax: String.raw`\x1B\x69 n1 n2`, descriptionKey: "starPrintMode", dialect: "star" },
  {
    name: "starEscGsE",
    syntax: String.raw`\x1B\x1D\x29\x45 pL pH fn ...`,
    descriptionKey: "starEscGsE",
    dialect: "star",
  },
  {
    name: "starEscGsI",
    syntax: String.raw`\x1B\x1D\x29\x49 pL pH fn ...`,
    descriptionKey: "starEscGsI",
    dialect: "star",
  },
  { name: "gsCharTable", syntax: String.raw`\x1D\x28\x4E pL pH fn m`, descriptionKey: "gsCharTable", dialect: "standard" },
  {
    name: "gsPrintDensity",
    syntax: String.raw`\x1D\x28\x41 pL pH fn n`,
    descriptionKey: "gsPrintDensity",
    dialect: "standard",
  },
  { name: "cashDrawer", syntax: String.raw`\x1B\x70`, descriptionKey: "cashDrawer", dialect: "common" },
];

export function lookupCommands(names: string[], source: CommandEntry[]): CommandEntry[] {
  return names
    .map((name) => source.find((entry) => entry.name === name))
    .filter((entry): entry is CommandEntry => entry != null);
}
