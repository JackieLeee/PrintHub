import { isCashDrawerOnlyEscPos } from "@virt-printer/shared";

/** Strip ESC/POS status / poll sequences, returning bytes that may be print content. */
export function stripEscPosStatusSequences(payload: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < payload.length) {
    const b = payload[i]!;

    // DLE EOT n — real-time status poll
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

    // ENQ — printer status request
    if (b === 0x05) {
      i += 1;
      continue;
    }

    // GS V m [n] — paper cut / feed (often bundled with status polls)
    if (b === 0x1d && i + 1 < payload.length && payload[i + 1] === 0x56) {
      i += 2;
      if (i < payload.length) {
        const mode = payload[i]!;
        i += 1;
        // GS V 66 n — feed and cut (two-byte form)
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

/** Returns true when payload is a status poll / heartbeat, not printable content. */
export function isEscPosStatusOrHeartbeat(payload: Uint8Array): boolean {
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

/** Build printer status bytes for each DLE EOT n found in a TCP chunk. */
export function buildDleEotResponses(payload: Uint8Array): Uint8Array[] {
  const responses: Uint8Array[] = [];
  for (let i = 0; i + 2 < payload.length; i++) {
    if (
      payload[i] === 0x10 &&
      payload[i + 1] === 0x04 &&
      payload[i + 2]! >= 0x01 &&
      payload[i + 2]! <= 0x04
    ) {
      responses.push(dleEotStatusByte(payload[i + 2]!));
      i += 2;
    }
  }
  return responses;
}

/** Single-byte ESC/POS real-time status response for DLE EOT n. */
function dleEotStatusByte(n: number): Uint8Array {
  switch (n) {
    case 1:
      // Online, paper OK (bit3=0 offline, bit5=0 paper end)
      return new Uint8Array([0x12]);
    case 2:
      // Offline status — report online
      return new Uint8Array([0x12]);
    case 3:
      // Error status — no error
      return new Uint8Array([0x00]);
    case 4:
      // Paper sensor — paper present
      return new Uint8Array([0x00]);
    default:
      return new Uint8Array([0x12]);
  }
}

/** True when payload likely contains receipt/label content worth storing. */
export function isMeaningfulPrintJob(payload: Uint8Array, protocol: "escpos" | "tspl"): boolean {
  if (payload.length === 0) return false;
  if (protocol === "tspl") return payload.length > 16;
  if (isCashDrawerOnlyEscPos(payload)) return false;
  return !isEscPosStatusOrHeartbeat(payload);
}
