import type { Protocol, PrinterSimConfig, PrinterSimScenario } from "@virt-printer/shared";
import { isCashDrawerOnlyEscPos } from "@virt-printer/shared";
import { dleEotStatusByte } from "./printer-sim.js";

/** Strip ESC/POS status / poll sequences, returning bytes that may be print content. */
function stripEscPosStatusSequences(payload: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < payload.length) {
    const b = payload[i]!;

    if (
      b === 0x10 &&
      i + 2 < payload.length &&
      payload[i + 1] === 0x04 &&
      payload[i + 2]! >= 0x01 &&
      payload[i + 2]! <= 0x04
    ) {
      i += 3;
      continue;
    }

    if (b === 0x05) {
      i += 1;
      continue;
    }

    if (b === 0x1d && i + 1 < payload.length && payload[i + 1] === 0x56) {
      i += 2;
      if (i < payload.length) {
        const mode = payload[i]!;
        i += 1;
        if (mode === 0x42 && i < payload.length) i += 1;
      }
      continue;
    }

    out.push(b);
    i += 1;
  }
  return new Uint8Array(out);
}

function isDleEotOnly(payload: Uint8Array): boolean {
  return (
    payload.length === 3 &&
    payload[0] === 0x10 &&
    payload[1] === 0x04 &&
    payload[2]! >= 0x01 &&
    payload[2]! <= 0x04
  );
}

function isEscPosStatusOrHeartbeat(payload: Uint8Array): boolean {
  if (payload.length === 0) return true;
  if (isDleEotOnly(payload)) return true;
  if (payload.length === 1 && (payload[0] === 0x05 || payload[0] === 0x10)) return true;

  const stripped = stripEscPosStatusSequences(payload);
  if (stripped.length === 0) return true;

  for (const b of stripped) {
    if (b >= 0x20) return false;
    if (b >= 0x80) return false;
  }
  return true;
}

/** Build printer status / ACK bytes for ENQ and DLE EOT polls in a TCP chunk. */
export function buildDleEotResponses(
  payload: Uint8Array,
  config?: PrinterSimConfig,
): Uint8Array[] {
  if (config?.scenario === "offline") return [];
  const scenario: PrinterSimScenario = config?.scenario ?? "normal";
  const responses: Uint8Array[] = [];

  for (let i = 0; i < payload.length; i++) {
    if (payload[i] === 0x05) {
      // ENQ — many POS drivers expect ACK before/after sending print data.
      responses.push(new Uint8Array([0x06]));
    }
  }

  for (let i = 0; i + 2 < payload.length; i++) {
    if (
      payload[i] === 0x10 &&
      payload[i + 1] === 0x04 &&
      payload[i + 2]! >= 0x01 &&
      payload[i + 2]! <= 0x04
    ) {
      const n = payload[i + 2]!;
      responses.push(new Uint8Array([dleEotStatusByte(n, scenario)]));
      i += 2;
    }
  }
  return responses;
}

export function isMeaningfulPrintJob(payload: Uint8Array, protocol: Protocol): boolean {
  if (payload.length === 0) return false;
  if (protocol === "tspl") return payload.length > 16;
  if (isCashDrawerOnlyEscPos(payload)) return false;
  return !isEscPosStatusOrHeartbeat(payload);
}

/** Remove trailing status polls / heartbeat bytes appended after print data. */
export function trimTrailingStatusPolls(payload: Uint8Array): Uint8Array {
  let end = payload.length;
  while (end > 0) {
    let matched = false;

    if (
      end >= 3 &&
      payload[end - 3] === 0x10 &&
      payload[end - 2] === 0x04 &&
      payload[end - 1]! >= 0x01 &&
      payload[end - 1]! <= 0x04
    ) {
      end -= 3;
      matched = true;
    } else if (end >= 1 && payload[end - 1] === 0x05) {
      end -= 1;
      matched = true;
    } else if (
      end >= 4 &&
      payload[end - 4] === 0x1d &&
      payload[end - 3] === 0x56 &&
      payload[end - 2] === 0x42
    ) {
      end -= 4;
      matched = true;
    } else if (end >= 3 && payload[end - 3] === 0x1d && payload[end - 2] === 0x56) {
      end -= 3;
      matched = true;
    } else if (end >= 2 && payload[end - 2] === 0x1d && payload[end - 1] === 0x56) {
      end -= 2;
      matched = true;
    }

    if (!matched) break;
  }
  return payload.subarray(0, end);
}

/** Normalize raw TCP bytes into printable payload (drops trailing heartbeats). */
export function prepareTcpPrintPayload(raw: Uint8Array): Uint8Array | null {
  const trimmed = trimTrailingStatusPolls(raw);
  if (trimmed.length === 0) return null;
  return trimmed;
}
