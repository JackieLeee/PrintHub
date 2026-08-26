export function payloadToHex(data: Uint8Array, maxBytes = 8192): string {
  const slice = data.length > maxBytes ? data.subarray(0, maxBytes) : data;
  const hex = Array.from(slice)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
  return data.length > maxBytes ? `${hex} … (+${data.length - maxBytes} bytes)` : hex;
}

export function payloadToHexCompact(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function payloadToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]!);
  return btoa(binary);
}

export function downloadPayload(data: Uint8Array, filename: string): void {
  const blob = new Blob([data], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // HTTP (non-localhost) is not a secure context — fall back below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  try {
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("execCommand copy failed");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function defaultPayloadFilename(protocol: string, jobId: string): string {
  const ext = protocol === "tspl" ? "tspl" : "bin";
  return `print-${jobId.slice(0, 8)}.${ext}`;
}
