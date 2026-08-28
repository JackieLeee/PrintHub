import { randomUUID } from "node:crypto";
import type { PrinterSimConfig, PrinterSimEvent, PrinterSimScenario } from "@virt-printer/shared";
import { DEFAULT_PRINTER_SIM_CONFIG, MAX_SIM_EVENTS } from "@virt-printer/shared";

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
    statusDelayMs: Math.max(0, Math.min(5000, partial?.statusDelayMs ?? DEFAULT_PRINTER_SIM_CONFIG.statusDelayMs)),
  };
}

export function dleEotStatusByte(n: number, scenario: PrinterSimScenario): number {
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

export class PrinterSimState {
  private config: PrinterSimConfig = { ...DEFAULT_PRINTER_SIM_CONFIG };
  private events: PrinterSimEvent[] = [];

  getConfig(): PrinterSimConfig {
    return { ...this.config };
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
    return this.config.scenario === "reject-job" || this.config.rejectPrint;
  }

  statusDelayMs(): number {
    return this.config.scenario === "slow" ? Math.max(500, this.config.statusDelayMs) : this.config.statusDelayMs;
  }

  isOffline(): boolean {
    return this.config.scenario === "offline";
  }

  pushEvent(
    kind: PrinterSimEvent["kind"],
    detail: string,
    sourceIp?: string,
  ): PrinterSimEvent | null {
    if (!this.config.logEvents && kind !== "scenario-change") return null;
    const event: PrinterSimEvent = {
      id: randomUUID(),
      at: Date.now(),
      kind,
      detail,
      sourceIp,
    };
    this.events = [event, ...this.events].slice(0, MAX_SIM_EVENTS);
    return event;
  }

  recordStatusPoll(sourceIp: string, n: number): PrinterSimEvent | null {
    const byte = dleEotStatusByte(n, this.config.scenario);
    return this.pushEvent("status-poll", `DLE EOT ${n} → 0x${byte.toString(16).padStart(2, "0")}`, sourceIp);
  }

  recordCashDrawer(sourceIp: string, pin: number, pulseOn: number, pulseOff: number, manual = false): PrinterSimEvent | null {
    return this.pushEvent(
      manual ? "manual-drawer" : "cash-drawer",
      `ESC p pin=${pin} t1=${pulseOn} t2=${pulseOff}`,
      sourceIp,
    );
  }

  recordJobRejected(sourceIp: string, bytes: number): PrinterSimEvent | null {
    return this.pushEvent("job-rejected", `Rejected print job (${bytes} bytes)`, sourceIp);
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
