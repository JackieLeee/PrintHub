#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { analyzePrintPayload } from "./analyze.js";

const path = process.argv[2];
if (!path) {
  console.error("Usage: printhub-analyze <file.bin|file.tspl>");
  process.exit(1);
}

const payload = new Uint8Array(readFileSync(path));
const result = analyzePrintPayload(payload);
console.log(JSON.stringify(result, null, 2));
