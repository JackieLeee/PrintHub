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

/** True when payload is only status polls plus ESC @ (optional) and ESC p drawer pulse(s). */
export function isCashDrawerOnlyEscPos(payload: Uint8Array): boolean {
  let i = 0;
  let sawDrawer = false;

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

    if (b === 0x1b && i + 1 < payload.length && payload[i + 1] === 0x40) {
      i += 2;
      continue;
    }

    if (b === 0x1b && i + 4 < payload.length && payload[i + 1] === 0x70) {
      sawDrawer = true;
      i += 5;
      continue;
    }

    return false;
  }

  return sawDrawer;
}
