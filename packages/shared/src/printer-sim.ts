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
  | "job-completed"
  | "scenario-change"
  | "manual-drawer";

export type TcpQueueState = "receiving" | "queued" | "processing";

export interface TcpQueueEntry {
  sessionId: string;
  sourceIp: string;
  state: TcpQueueState;
  bufferedBytes: number;
}

export interface PrinterSimLiveState {
  online: boolean;
  paperOut: boolean;
  coverOpen: boolean;
  queueDepth: number;
}

export interface PrinterSimConfig {
  scenario: PrinterSimScenario;
  /** Delay before writing DLE EOT status bytes. */
  statusDelayMs: number;
  /** Delay before accepting / ACKing a print job (simulates busy printer). */
  printDelayMs: number;
  /** Reject print jobs on paper-out, cover-open, and offline (in addition to reject-job). */
  blockPrintOnFault: boolean;
  /** Drop TCP print jobs after receive (reject-job scenario legacy flag). */
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
  /** DLE EOT poll parameter n (1–4). */
  pollN?: number;
  /** Status byte returned to POS. */
  pollByte?: number;
  jobBytes?: number;
  /** receivedAt → processed (ms). */
  durationMs?: number;
  /** Time to send TCP ACK after processing (ms). */
  ackMs?: number;
}

export const MAX_STATUS_DELAY_MS = 30_000;
export const MAX_PRINT_DELAY_MS = 60_000;

export const DEFAULT_PRINTER_SIM_CONFIG: PrinterSimConfig = {
  scenario: "normal",
  statusDelayMs: 0,
  printDelayMs: 0,
  blockPrintOnFault: true,
  rejectPrint: false,
  logEvents: true,
};

export const MAX_SIM_EVENTS = 50;

export function computeSimLiveState(
  scenario: PrinterSimScenario,
  queueDepth: number,
): PrinterSimLiveState {
  return {
    online: scenario !== "offline",
    paperOut: scenario === "paper-out",
    coverOpen: scenario === "cover-open",
    queueDepth,
  };
}

export function isFaultScenario(scenario: PrinterSimScenario): boolean {
  return scenario === "paper-out" || scenario === "cover-open" || scenario === "offline";
}
