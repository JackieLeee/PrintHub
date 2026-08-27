import { readUint16LE } from "./encoding.js";
import { parseEscPosInspector } from "./inspector/parser.js";
import { mapInspectorToLegacy } from "./legacy-map.js";
import type { EscPosParseResult } from "./types.js";

/** Legacy AST entry point — delegates to inspector parser + command mapper. */
export function parseEscPos(payload: Uint8Array): EscPosParseResult {
  const { commands, warnings } = parseEscPosInspector(payload);
  return {
    commands: mapInspectorToLegacy(commands),
    warnings,
  };
}

export { readUint16LE };
