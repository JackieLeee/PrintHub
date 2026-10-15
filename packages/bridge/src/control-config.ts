import type { PrinterSimConfig } from "@virt-printer/shared";
import { MAX_PRINT_DELAY_MS, MAX_STATUS_DELAY_MS } from "@virt-printer/shared";

export const scenarios = ["normal", "paper-out", "cover-open", "offline", "slow", "reject-job"] as const;
export function validateConfigPatch(value: unknown): asserts value is Partial<PrinterSimConfig> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("config must be an object");
  for (const [key, val] of Object.entries(value)) {
    if (key === "scenario") {
      if (!scenarios.includes(val as typeof scenarios[number])) throw new Error("invalid scenario");
    } else if (key === "statusDelayMs" || key === "printDelayMs") {
      const max = key === "statusDelayMs" ? MAX_STATUS_DELAY_MS : MAX_PRINT_DELAY_MS;
      if (!Number.isInteger(val) || (val as number) < 0 || (val as number) > max) throw new Error(`invalid ${key}`);
    } else if (["blockPrintOnFault", "rejectPrint", "logEvents"].includes(key)) {
      if (typeof val !== "boolean") throw new Error(`invalid ${key}`);
    } else throw new Error(`unknown config field: ${key}`);
  }
}
