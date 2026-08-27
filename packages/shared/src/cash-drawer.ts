export interface CashDrawerKick {
  pin: number;
  pulseOn: number;
  pulseOff: number;
  offset: number;
}

/** Scan payload for ESC p (0x1B 0x70) cash-drawer pulse commands. */
export function findCashDrawerKicks(payload: Uint8Array): CashDrawerKick[] {
  const hits: CashDrawerKick[] = [];
  for (let i = 0; i + 4 < payload.length; i++) {
    if (payload[i] === 0x1b && payload[i + 1] === 0x70) {
      hits.push({
        pin: payload[i + 2]!,
        pulseOn: payload[i + 3]!,
        pulseOff: payload[i + 4]!,
        offset: i,
      });
      i += 4;
    }
  }
  return hits;
}
