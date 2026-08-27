import type { TsplCommand } from "./types.js";

function formatDim(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, "");
}

export function formatLabelSize(commands: TsplCommand[]): string | null {
  for (const cmd of commands) {
    if (cmd.kind !== "size") continue;
    const w = formatDim(cmd.width);
    const h = formatDim(cmd.height);
    if (cmd.unit === "mm") return `${w}×${h} mm`;
    if (cmd.unit === "inch") return `${w}×${h} in`;
    return `${w}×${h} dot`;
  }
  return null;
}
