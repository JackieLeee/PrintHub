function hasTsplCommandSignature(text: string): boolean {
  if (/\bSIZE\s+[\d.]+\s*(MM|INCH|DOT)\b/i.test(text)) return true;
  if (/\bTEXT\s+\d+,\d+,\s*"/i.test(text)) return true;
  if (/\bPRINT\s+\d/i.test(text)) return true;
  if (/\bBITMAP\s+\d+,\d+,\s*\d+/i.test(text)) return true;
  if (/\bBARCODE\s+\d+,\d+,\s*"/i.test(text)) return true;
  if (/\bQRCODE\s+\d+,\d+,\s*[A-Z]/i.test(text)) return true;
  if (/(?:^|[\r\n])CLS(?:[\r\n]|$)/m.test(text)) return true;
  if (/\bGAP\s+[\d.]+\s*(MM|INCH|DOT)\b/i.test(text)) return true;
  if (/\bDIRECTION\s+\d/i.test(text)) return true;
  if (/\bREFERENCE\s+\d/i.test(text)) return true;
  return false;
}

/** True when payload contains TSPL label commands (may follow ESC/POS init bytes). */
export function isTsplPayload(payload: Uint8Array): boolean {
  if (payload.length === 0) return false;

  const sampleLen = Math.min(payload.length, 16384);
  const sample = new TextDecoder("latin1").decode(payload.subarray(0, sampleLen));

  return hasTsplCommandSignature(sample);
}
