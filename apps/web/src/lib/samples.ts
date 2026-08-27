/** ESC/POS sample from EscPosInspector demo receipt. */
export const ESCPOS_SAMPLE_BASE64 =
  "G0AbYQFFU0MvUE9TIFJFQ0VJUFQgSU5TUEVDVE9SChthAFNhbXBsZSB0aGVybWFsIHJlY2VpcHQgZm9yIGRlYnVnZ2luZwotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQobRQFCb2xkIGl0ZW0bRQAgICAgICAgICAgJDEyLjUwCkNvZmZlZSAgICAgICAgICAgICAgICAgICAgJDMuMDAKTXVmZmluICAgICAgICAgICAgICAgICAgICAkNC41MAobYQJUb3RhbDogJDIwLjAwChthARszGBsqIUAA////////////////8CBA4ECB4IEC4QIE4gQI5AgQ6BAg8CBA4ECB4IEC4QIE4gQI5AgQ6BAg8CBA4ECB4IEC4QIE4gQI5AgQ6BAg8CBA4ECB4IEC4QIE4gQI5AgQ6BAg8CBA4ECB4IEC4QIE4gQI5AgQ6BAg8CBA4ECB4IEC4QIE4gQI5AgQ6BAg8CBA4ECB4IEC4QIE4gQI5AgQ6BAg8CBA4ECB4IEC4QIE4gQI5AgQ6BAg////////////////ChsqIUAA////////////////gQIHAgQPBAgXCBAnECBHIECHQIEHgQIHAgQPBAgXCBAnECBHIECHQIEHgQIHAgQPBAgXCBAnECBHIECHQIEHgQIHAgQPBAgXCBAnECBHIECHQIEHgQIHAgQPBAgXCBAnECBHIECHQIEHgQIHAgQPBAgXCBAnECBHIECHQIEHgQIHAgQPBAgXCBAnECBHIECHQIEHgQIHAgQPBAgXCBAnECBHIECHQIEH////////////////ChsyG2EBHWtJCjEyMzQ1Njc4OTAbZAIdKGsEADFBMgAdKGsDADFDBR0oawMAMUUxHShrLgAxUDBodHRwczovL2dpdGh1Yi5jb20vZXhhbXBsZS9lc2Nwb3MtaW5zcGVjdG9yHShrAwAxUTAbZAQ=";

const TSPL_SAMPLE = [
  "SIZE 40 mm,30 mm",
  "GAP 2 mm,0",
  "DIRECTION 0",
  "REFERENCE 0,0",
  "CLS",
  'TEXT 10,12,"0",0,1,1,"PrintHub"',
  'TEXT 10,36,"0",0,1,1,"TSPL Sample Label"',
  'BARCODE 10,70,"128",64,1,0,2,4,"1234567890"',
  'QRCODE 10,170,L,4,A,0,"https://github.com/JackieLeee/PrintHub"',
  "PRINT 1",
].join("\r\n");

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function getEscPosSampleBytes(): Uint8Array {
  return decodeBase64(ESCPOS_SAMPLE_BASE64);
}

export function getTsplSampleBytes(): Uint8Array {
  return new TextEncoder().encode(`${TSPL_SAMPLE}\r\n`);
}

export const ESCPOS_SAMPLE_FILENAME = "escpos-sample.bin";
export const TSPL_SAMPLE_FILENAME = "tspl-sample.bin";
