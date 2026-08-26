import type { PrintJobMeta } from "@virt-printer/shared";
import { DEFAULT_HISTORY_LIMIT } from "@virt-printer/shared";

const DB_NAME = "virt-printer-hub";
const STORE = "jobs";
const DB_VERSION = 2;

export interface StoredJobRecord extends PrintJobMeta {
  payloadBase64: string;
  hubId: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;
      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE)) {
        store = db.createObjectStore(STORE, { keyPath: "id" });
      } else {
        store = req.transaction!.objectStore(STORE);
      }
      if (!store.indexNames.contains("receivedAt")) {
        store.createIndex("receivedAt", "receivedAt", { unique: false });
      }
      if (!store.indexNames.contains("hubId")) {
        store.createIndex("hubId", "hubId", { unique: false });
      }
      if (!store.indexNames.contains("hubReceivedAt")) {
        store.createIndex("hubReceivedAt", ["hubId", "receivedAt"], { unique: false });
      }
      if (oldVersion > 0 && oldVersion < 2) {
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) return;
          const val = cursor.value as StoredJobRecord & { hubId?: string };
          if (!val.hubId) {
            val.hubId = "legacy";
            cursor.update(val);
          }
          cursor.continue();
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export async function loadJobs(hubId?: string, limit = DEFAULT_HISTORY_LIMIT): Promise<StoredJobRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const index = hubId ? store.index("hubReceivedAt") : store.index("receivedAt");
    const range = hubId ? IDBKeyRange.bound([hubId, 0], [hubId, Number.MAX_SAFE_INTEGER]) : null;
    const req = index.openCursor(range, "prev");
    const rows: StoredJobRecord[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && rows.length < limit) {
        const val = cursor.value as StoredJobRecord;
        if (!hubId || val.hubId === hubId) rows.push(val);
        cursor.continue();
      } else {
        resolve(rows);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

const pendingWrites = new Map<string, { meta: PrintJobMeta; payload: Uint8Array; hubId: string }>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 120;

async function flushPending(): Promise<void> {
  flushTimer = null;
  if (pendingWrites.size === 0) return;
  const batch = [...pendingWrites.values()];
  pendingWrites.clear();

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const item of batch) {
      const record: StoredJobRecord = {
        ...item.meta,
        hubId: item.hubId,
        payloadBase64: bytesToBase64(item.payload),
      };
      store.put(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  if (batch[0]?.hubId) await trimOldJobs(batch[0].hubId, DEFAULT_HISTORY_LIMIT);
}

export function saveJob(meta: PrintJobMeta, payload: Uint8Array, hubId: string): Promise<void> {
  pendingWrites.set(meta.id, { meta, payload, hubId });
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      void flushPending();
    }, FLUSH_MS);
  }
  return Promise.resolve();
}

export async function flushHistory(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushPending();
}

async function trimOldJobs(hubId: string, keep: number): Promise<void> {
  const all = await loadJobs(hubId, keep + 50);
  if (all.length <= keep) return;
  const db = await openDb();
  const toDelete = all.slice(keep);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const row of toDelete) store.delete(row.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function recordToJob(record: StoredJobRecord): { meta: PrintJobMeta; payload: Uint8Array } {
  const { payloadBase64, hubId: _hub, ...meta } = record;
  return { meta, payload: base64ToBytes(payloadBase64) };
}

export { base64ToBytes, bytesToBase64 };
