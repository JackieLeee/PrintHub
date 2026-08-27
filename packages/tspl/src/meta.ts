import type { TsplCommand, TsplLabelMeta } from "./types.js";
import { defaultLabelMeta } from "./types.js";
import { toDots } from "./utils.js";

/** Collect label layout / hardware settings from parsed TSPL commands. */
export function resolveTsplLabelMeta(commands: TsplCommand[]): TsplLabelMeta {
  const meta = defaultLabelMeta();

  for (const cmd of commands) {
    switch (cmd.kind) {
      case "size":
        meta.widthDots = toDots(cmd.width, cmd.unit);
        meta.heightDots = toDots(cmd.height, cmd.unit);
        meta.unit = cmd.unit;
        break;
      case "direction":
        meta.direction = cmd.value;
        meta.mirror = cmd.mirror;
        break;
      case "reference":
        meta.reference = { x: cmd.x, y: cmd.y };
        break;
      case "shift":
        meta.shift = { x: cmd.x, y: cmd.y };
        break;
      case "gap":
      case "bline":
        meta.gap = {
          valueDots: toDots(cmd.value, cmd.unit),
          sensorOffsetDots: toDots(cmd.sensorOffset, cmd.unit),
        };
        break;
      case "offset":
        meta.feedOffsetDots = toDots(cmd.value, cmd.unit);
        break;
      case "speed":
        meta.speed = cmd.ips;
        break;
      case "density":
        meta.density = cmd.level;
        break;
    }
  }

  return meta;
}
