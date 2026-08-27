import type { PrintJobMeta, Protocol } from "@virt-printer/shared";
import { isTsplPayload } from "@virt-printer/tspl";
import { newLocalJobId } from "./local-sim.js";

/** Hub id for jobs created locally (debug print) without Bridge. */
export const LOCAL_HUB_ID = "local";

export function detectProtocol(payload: Uint8Array): Protocol {
  return isTsplPayload(payload) ? "tspl" : "escpos";
}

export function createLocalJobMeta(payload: Uint8Array, _label: string): PrintJobMeta {
  return {
    id: newLocalJobId(),
    protocol: detectProtocol(payload),
    sourceIp: "local",
    sessionId: "debug",
    receivedAt: Date.now(),
    byteLength: payload.length,
    source: "debug",
    hubId: LOCAL_HUB_ID,
  };
}
