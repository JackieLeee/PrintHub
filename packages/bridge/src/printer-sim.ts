import { randomUUID } from "node:crypto";
import type { PrinterSimConfig, PrinterSimEvent } from "@virt-printer/shared";
import {
  DEFAULT_PRINTER_SIM_CONFIG,
  isFaultScenario,
  MAX_PRINT_DELAY_MS,
  MAX_SIM_EVENTS,
  MAX_STATUS_DELAY_MS,
} from "@virt-printer/shared";

export interface CashDrawerKick {
  pin: number;
  pulseOn: number;
  pulseOff: number;
  offset: number;
}

export function resolveSimConfig(partial?: Partial<PrinterSimConfig>): PrinterSimConfig {
  return {
    ...DEFAULT_PRINTER_SIM_CONFIG,
    ...partial,
    scenario: partial?.scenario ?? DEFAULT_PRINTER_SIM_CONFIG.scenario,
    statusDelayMs: Math.max(
      0,
      Math.min(MAX_STATUS_DELAY_MS, partial?.statusDelayMs ?? DEFAULT_PRINTER_SIM_CONFIG.statusDelayMs),
    ),
    printDelayMs: Math.max(
      0,
      Math.min(MAX_PRINT_DELAY_MS, partial?.printDelayMs ?? DEFAULT_PRINTER_SIM_CONFIG.printDelayMs),
    ),
    blockPrintOnFault: partial?.blockPrintOnFault ?? DEFAULT_PRINTER_SIM_CONFIG.blockPrintOnFault,
  };
}

export function dleEotStatusByte(n: number, scenario: PrinterSimConfig["scenario"]): number {
  if (scenario === "offline") return 0x00;
  if (scenario === "paper-out" && (n === 2 || n === 4)) return 0x04;
  if (scenario === "cover-open" && n === 2) return 0x20;
  switch (n) {
    case 1:
    case 2:
      return 0x12;
    case 3:
    case 4:
      return 0x00;
    default:
      return 0x12;
  }
}

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

type EventExtra = Pick<PrinterSimEvent, "pollN" | "pollByte" | "jobBytes" | "durationMs" | "ackMs">;

export class PrinterSimState {
  private config: PrinterSimConfig = { ...DEFAULT_PRINTER_SIM_CONFIG };
  private events: PrinterSimEvent[] = [];

  getConfig(): PrinterSimConfig {
    return { ...this.config };
  }

  clearEvents(): void {
    this.events = [];
  }

  getEvents(): PrinterSimEvent[] {
    return [...this.events];
  }

  setConfig(partial: Partial<PrinterSimConfig>, sourceIp?: string): PrinterSimConfig {
    const prev = this.config.scenario;
    this.config = resolveSimConfig({ ...this.config, ...partial });
    if (partial.scenario && partial.scenario !== prev) {
      this.pushEvent("scenario-change", `Scenario → ${this.config.scenario}`, sourceIp);
    }
    return this.getConfig();
  }

  shouldRejectPrint(): boolean {
    if (this.config.scenario === "reject-job" || this.config.rejectPrint) return true;
    if (this.config.blockPrintOnFault && isFaultScenario(this.config.scenario)) return true;
    return false;
  }

  statusDelayMs(): number {
    return this.config.scenario === "slow"
      ? Math.max(500, this.config.statusDelayMs)
      : this.config.statusDelayMs;
  }

  printDelayMs(): number {
    return this.config.printDelayMs;
  }

  isOffline(): boolean {
    return this.config.scenario === "offline";
  }

  pushEvent(
    kind: PrinterSimEvent["kind"],
    detail: string,
    sourceIp?: string,
    extra?: EventExtra,
  ): PrinterSimEvent | null {
    if (!this.config.logEvents && kind !== "scenario-change") return null;
    const event: PrinterSimEvent = {
      id: randomUUID(),
      at: Date.now(),
      kind,
      detail,
      sourceIp,
      ...extra,
    };
    this.events = [event, ...this.events].slice(0, MAX_SIM_EVENTS);
    return event;
  }

  recordStatusPoll(sourceIp: string, n: number): PrinterSimEvent | null {
    const byte = dleEotStatusByte(n, this.config.scenario);
    return this.pushEvent("status-poll", `DLE EOT ${n} → 0x${byte.toString(16).padStart(2, "0")}`, sourceIp, {
      pollN: n,
      pollByte: byte,
    });
  }

  recordCashDrawer(
    sourceIp: string,
    pin: number,
    pulseOn: number,
    pulseOff: number,
    manual = false,
  ): PrinterSimEvent | null {
    return this.pushEvent(
      manual ? "manual-drawer" : "cash-drawer",
      `ESC p pin=${pin} t1=${pulseOn} t2=${pulseOff}`,
      sourceIp,
    );
  }

  recordJobRejected(sourceIp: string, bytes: number): PrinterSimEvent | null {
    return this.pushEvent("job-rejected", `Rejected print job (${bytes} bytes)`, sourceIp, { jobBytes: bytes });
  }

  recordJobCompleted(
    sourceIp: string,
    bytes: number,
    durationMs: number,
    ackMs?: number,
  ): PrinterSimEvent | null {
    return this.pushEvent(
      "job-completed",
      `Print job (${bytes} bytes) · ${durationMs} ms` + (ackMs != null ? ` · ACK ${ackMs} ms` : ""),
      sourceIp,
      { jobBytes: bytes, durationMs, ackMs },
    );
  }

  scanPayloadForDrawer(payload: Uint8Array, sourceIp: string): PrinterSimEvent[] {
    const emitted: PrinterSimEvent[] = [];
    for (const kick of findCashDrawerKicks(payload)) {
      const ev = this.recordCashDrawer(sourceIp, kick.pin, kick.pulseOn, kick.pulseOff);
      if (ev) emitted.push(ev);
    }
    return emitted;
  }
}
