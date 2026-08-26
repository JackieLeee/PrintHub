/** DLE EOT n — real-time status transmission (printer heartbeat / poll). */
function isDleEotStatus(payload: Uint8Array): boolean {
  return (
    payload.length >= 3 &&
    payload[0] === 0x10 &&
    payload[1] === 0x04 &&
    payload[2]! >= 0x01 &&
    payload[2]! <= 0x04 &&
    payload.length === 3
  );
}

/** Returns true when payload is a status poll / heartbeat, not printable content. */
export function isEscPosStatusOrHeartbeat(payload: Uint8Array): boolean {
  if (payload.length === 0) return true;
  if (isDleEotStatus(payload)) return true;
  if (payload.length === 1 && (payload[0] === 0x05 || payload[0] === 0x10)) return true;

  if (payload.length <= 8) {
    for (const b of payload) {
      if (b >= 0x20 && b <= 0x7e) return false;
      if (b >= 0x80) return false;
    }
    return true;
  }

  return false;
}

/** True when payload likely contains receipt/label content worth storing. */
export function isMeaningfulPrintJob(payload: Uint8Array, protocol: "escpos" | "tspl"): boolean {
  if (payload.length === 0) return false;
  if (protocol === "tspl") return payload.length > 16;
  return !isEscPosStatusOrHeartbeat(payload);
}
