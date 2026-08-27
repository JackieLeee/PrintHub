import type { ParsedCommand } from "@virt-printer/escpos";

const LAYOUT_CATEGORIES = new Set([
  "alignment",
  "font",
  "style",
  "feed",
  "lineFeed",
  "lineSpacing",
  "initialize",
  "cut",
]);

/** Subset of parsed ESC/POS commands for text-only or raster-only preview. */
export function filterEscPosCommands(
  commands: ParsedCommand[],
  mode: "text" | "raster",
): ParsedCommand[] {
  if (mode === "text") {
    return commands.filter(
      (c) => c.category === "text" || LAYOUT_CATEGORIES.has(c.category),
    );
  }
  return commands.filter(
    (c) =>
      c.category === "image" ||
      c.category === "rasterImage" ||
      c.category === "feed" ||
      c.category === "lineFeed" ||
      c.category === "initialize",
  );
}

export function escPosHasRaster(commands: ParsedCommand[]): boolean {
  return commands.some(
    (c) => c.category === "image" || c.category === "rasterImage",
  );
}

/** True when payload includes printable text (not just layout/feed commands). */
export function escPosHasTextContent(commands: ParsedCommand[]): boolean {
  return commands.some(
    (c) => c.category === "text" && c.text.trim().length > 0,
  );
}
