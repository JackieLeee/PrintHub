export type PrinterSimScenario =
  | "normal"
  | "paper-out"
  | "cover-open"
  | "offline"
  | "slow"
  | "reject-job";

export type PrinterSimEventKind =
  | "status-poll"
  | "cash-drawer"
  | "job-rejected"
  | "scenario-change"
  | "manual-drawer";

export interface PrinterSimConfig {
  scenario: PrinterSimScenario;
  /** Delay before writing DLE EOT status bytes (slow scenario). */
  statusDelayMs: number;
  /** Drop TCP print jobs after receive (reject-job scenario). */
  rejectPrint: boolean;
  /** Emit sim.event over WebSocket. */
  logEvents: boolean;
}

export interface PrinterSimEvent {
  id: string;
  at: number;
  kind: PrinterSimEventKind;
  detail: string;
  sourceIp?: string;
}

export const DEFAULT_PRINTER_SIM_CONFIG: PrinterSimConfig = {
  scenario: "normal",
  statusDelayMs: 0,
  rejectPrint: false,
  logEvents: true,
};

export const MAX_SIM_EVENTS = 50;
