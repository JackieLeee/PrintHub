/** True when running inside the Electron shell (preload IPC available). */
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && window.printhubDesktop?.isDesktop === true;
}

/** Electron ui-server entry; preload may attach shortly after first paint. */
export function isDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  if (isDesktopApp()) return true;
  return new URLSearchParams(window.location.search).get("desktop") === "1";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export async function readFileAsBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}
