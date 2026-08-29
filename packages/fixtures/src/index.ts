import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type FixtureProtocol = "escpos" | "tspl";

export interface FixtureExpect {
  minCommands?: number;
  maxUnsupported?: number;
  minTextCommands?: number;
  paperWidth?: number;
  maxWarnings?: number;
}

export interface FixtureEntry {
  id: string;
  file: string;
  protocol: FixtureProtocol;
  tags?: string[];
  expect: FixtureExpect;
}

export interface FixtureManifest {
  version: number;
  fixtures: FixtureEntry[];
}

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export function fixturesRoot(): string {
  return packageRoot;
}

export function loadManifest(): FixtureManifest {
  const raw = readFileSync(join(packageRoot, "manifest.json"), "utf8");
  return JSON.parse(raw) as FixtureManifest;
}

export function loadFixtureBytes(entry: FixtureEntry): Uint8Array {
  return new Uint8Array(readFileSync(join(packageRoot, entry.file)));
}

export function loadAllFixtures(): Array<FixtureEntry & { bytes: Uint8Array }> {
  return loadManifest().fixtures.map((entry) => ({
    ...entry,
    bytes: loadFixtureBytes(entry),
  }));
}
