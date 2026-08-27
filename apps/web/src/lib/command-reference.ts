export interface CommandEntry {
  name: string;
  syntax: string;
  descriptionKey: string;
}

export interface CommandCategory {
  titleKey: string;
  commandNames: string[];
}

export const TSPL_CATEGORIES: CommandCategory[] = [
  { titleKey: "labelSetup", commandNames: ["SIZE", "GAP", "DIRECTION", "REFERENCE", "OFFSET"] },
  {
    titleKey: "contentGraphics",
    commandNames: ["CLS", "TEXT", "BARCODE", "QRCODE", "BITMAP", "BOX", "BAR"],
  },
  { titleKey: "printControl", commandNames: ["PRINT", "DENSITY", "SPEED", "FEED", "BACKFEED"] },
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
    commandNames: ["barHeight", "barWidth", "hriPos", "printBarcode", "qr2d", "rasterImage", "bitmapMode"],
  },
  { titleKey: "deviceControl", commandNames: ["cutPaper", "cutPaperLegacy", "cashDrawer"] },
];

export const TSPL_COMMANDS: CommandEntry[] = [
  { name: "SIZE", syntax: 'SIZE w mm, h mm', descriptionKey: "size" },
  { name: "GAP", syntax: "GAP m mm, n mm", descriptionKey: "gap" },
  { name: "DIRECTION", syntax: "DIRECTION 0|1", descriptionKey: "direction" },
  { name: "REFERENCE", syntax: "REFERENCE x, y", descriptionKey: "reference" },
  { name: "OFFSET", syntax: "OFFSET x, y", descriptionKey: "offset" },
  { name: "CLS", syntax: "CLS", descriptionKey: "cls" },
  { name: "TEXT", syntax: 'TEXT x,y,"font",rot,xmul,ymul,"text"', descriptionKey: "text" },
  { name: "BARCODE", syntax: 'BARCODE x,y,"type",h,read,rot,n,w,"data"', descriptionKey: "barcode" },
  { name: "QRCODE", syntax: 'QRCODE x,y,ECC,cell,mode,rot,"data"', descriptionKey: "qrcode" },
  { name: "BITMAP", syntax: "BITMAP x,y,w,h,mode,data", descriptionKey: "bitmap" },
  { name: "BOX", syntax: "BOX x1,y1,x2,y2,linewidth", descriptionKey: "box" },
  { name: "BAR", syntax: "BAR x,y,width,height", descriptionKey: "bar" },
  { name: "PRINT", syntax: "PRINT m[,n]", descriptionKey: "print" },
  { name: "DENSITY", syntax: "DENSITY 0~15", descriptionKey: "density" },
  { name: "SPEED", syntax: "SPEED n", descriptionKey: "speed" },
  { name: "SET PEEL", syntax: "SET PEEL ON|OFF", descriptionKey: "setPeel" },
  { name: "SET TEAR", syntax: "SET TEAR ON|OFF", descriptionKey: "setTear" },
  { name: "SET CUTTER", syntax: "SET CUTTER ON|OFF", descriptionKey: "setCutter" },
  { name: "FEED", syntax: "FEED n", descriptionKey: "feed" },
  { name: "BACKFEED", syntax: "BACKFEED n", descriptionKey: "backfeed" },
  { name: "CODEPAGE", syntax: "CODEPAGE n", descriptionKey: "codepage" },
  { name: "SELFTEST", syntax: "SELFTEST", descriptionKey: "selftest" },
];

export const ESCPOS_COMMANDS: CommandEntry[] = [
  { name: "init", syntax: String.raw`\x1B\x40`, descriptionKey: "init" },
  { name: "align", syntax: String.raw`\x1B\x61 n`, descriptionKey: "align" },
  { name: "bold", syntax: String.raw`\x1B\x45 n`, descriptionKey: "bold" },
  { name: "underline", syntax: String.raw`\x1B\x2D n`, descriptionKey: "underline" },
  { name: "feedLines", syntax: String.raw`\x1B\x64 n`, descriptionKey: "feedLines" },
  { name: "feedDots", syntax: String.raw`\x1B\x4A n`, descriptionKey: "feedDots" },
  { name: "lineSpacingDefault", syntax: String.raw`\x1B\x32`, descriptionKey: "lineSpacingDefault" },
  { name: "lineSpacingSet", syntax: String.raw`\x1B\x33 n`, descriptionKey: "lineSpacingSet" },
  { name: "charSize", syntax: String.raw`\x1D\x21 n`, descriptionKey: "charSize" },
  { name: "invert", syntax: String.raw`\x1D\x42 n`, descriptionKey: "invert" },
  { name: "cutPaper", syntax: String.raw`\x1D\x56 m`, descriptionKey: "cutPaper" },
  { name: "barHeight", syntax: String.raw`\x1D\x68 n`, descriptionKey: "barHeight" },
  { name: "barWidth", syntax: String.raw`\x1D\x77 n`, descriptionKey: "barWidth" },
  { name: "hriPos", syntax: String.raw`\x1D\x48 n`, descriptionKey: "hriPos" },
  { name: "printBarcode", syntax: String.raw`\x1D\x6B m ...`, descriptionKey: "printBarcode" },
  { name: "qr2d", syntax: String.raw`\x1D\x28\x6B`, descriptionKey: "qr2d" },
  { name: "rasterImage", syntax: String.raw`\x1D\x76\x30`, descriptionKey: "rasterImage" },
  { name: "bitmapMode", syntax: String.raw`\x1B\x2A m`, descriptionKey: "bitmapMode" },
  { name: "cutPaperLegacy", syntax: String.raw`\x1B\x69`, descriptionKey: "cutPaperLegacy" },
  { name: "cashDrawer", syntax: String.raw`\x1B\x70`, descriptionKey: "cashDrawer" },
];

export function lookupCommands(names: string[], source: CommandEntry[]): CommandEntry[] {
  return names
    .map((name) => source.find((entry) => entry.name === name))
    .filter((entry): entry is CommandEntry => entry != null);
}
