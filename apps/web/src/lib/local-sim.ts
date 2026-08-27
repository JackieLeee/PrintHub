import type { PrinterSimEvent, PrinterSimEventKind } from "@virt-printer/shared";
import { MAX_SIM_EVENTS } from "@virt-printer/shared";

function newLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocalSimEvent(
  kind: PrinterSimEventKind,
  detail: string,
  sourceIp = "local",
): PrinterSimEvent {
  return {
    id: newLocalId(),
    at: Date.now(),
    kind,
    detail,
    sourceIp,
  };
}

export function prependSimEvent(
  events: PrinterSimEvent[],
  event: PrinterSimEvent,
): PrinterSimEvent[] {
  const filtered = events.filter((e) => e.id !== event.id);
  return [event, ...filtered].slice(0, MAX_SIM_EVENTS);
}

export function sortSimEvents(events: PrinterSimEvent[]): PrinterSimEvent[] {
  return [...events].sort((a, b) => b.at - a.at);
}

export { newLocalId as newLocalJobId };
