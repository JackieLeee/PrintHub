import { strictEqual, ok, deepStrictEqual } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseEscPosInspector } from "@virt-printer/escpos";
import { parseTspl } from "@virt-printer/tspl";
import { loadAllFixtures, type FixtureEntry } from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(here, "snapshots.json");
const UPDATE_SNAPSHOTS = process.env.UPDATE_SNAPSHOTS === "1";

interface ParseSnapshot {
  commandCount: number;
  unsupportedCount: number;
  textCommandCount: number;
  paperWidth?: number;
  warningCount: number;
  categories: Record<string, number>;
}

function escposSnapshot(bytes: Uint8Array): ParseSnapshot {
  const { commands, paperWidth, warnings } = parseEscPosInspector(bytes);
  const categories: Record<string, number> = {};
  for (const cmd of commands) {
    categories[cmd.category] = (categories[cmd.category] ?? 0) + 1;
  }
  return {
    commandCount: commands.length,
    unsupportedCount: categories.unsupported ?? 0,
    textCommandCount: categories.text ?? 0,
    paperWidth,
    warningCount: warnings.length,
    categories,
  };
}

function tsplSnapshot(bytes: Uint8Array): ParseSnapshot {
  const { commands, warnings } = parseTspl(bytes);
  const categories: Record<string, number> = {};
  for (const cmd of commands) {
    categories[cmd.kind] = (categories[cmd.kind] ?? 0) + 1;
  }
  return {
    commandCount: commands.length,
    unsupportedCount: categories.unknown ?? 0,
    textCommandCount: categories.text ?? 0,
    warningCount: warnings.length,
    categories,
  };
}

function snapshotFor(entry: FixtureEntry, bytes: Uint8Array): ParseSnapshot {
  return entry.protocol === "tspl" ? tsplSnapshot(bytes) : escposSnapshot(bytes);
}

function loadSnapshots(): Record<string, ParseSnapshot> {
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as Record<string, ParseSnapshot>;
  } catch {
    return {};
  }
}

describe("fixture library", () => {
  const fixtures = loadAllFixtures();

  it("loads at least 16 fixtures", () => {
    ok(fixtures.length >= 16);
  });

  for (const fixture of fixtures) {
    describe(fixture.id, () => {
      it("parses without throwing (L1)", () => {
        snapshotFor(fixture, fixture.bytes);
      });

      it("meets manifest expectations (L2)", () => {
        const snap = snapshotFor(fixture, fixture.bytes);
        const { expect } = fixture;

        if (expect.minCommands != null) {
          ok(
            snap.commandCount >= expect.minCommands,
            `commands ${snap.commandCount} < ${expect.minCommands}`,
          );
        }
        if (expect.maxUnsupported != null) {
          ok(
            snap.unsupportedCount <= expect.maxUnsupported,
            `unsupported ${snap.unsupportedCount} > ${expect.maxUnsupported}`,
          );
        }
        if (expect.minTextCommands != null) {
          ok(
            snap.textCommandCount >= expect.minTextCommands,
            `text ${snap.textCommandCount} < ${expect.minTextCommands}`,
          );
        }
        if (expect.paperWidth != null) {
          strictEqual(snap.paperWidth, expect.paperWidth);
        }
        if (expect.maxWarnings != null) {
          ok(
            snap.warningCount <= expect.maxWarnings,
            `warnings ${snap.warningCount} > ${expect.maxWarnings}`,
          );
        }
      });
    });
  }
});

describe("parse snapshots (L3)", () => {
  const fixtures = loadAllFixtures();
  let stored = loadSnapshots();

  if (UPDATE_SNAPSHOTS) {
    for (const fixture of fixtures) {
      stored[fixture.id] = snapshotFor(fixture, fixture.bytes);
    }
    writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
  }

  for (const fixture of fixtures) {
    it(`${fixture.id} matches snapshots.json`, () => {
      const current = snapshotFor(fixture, fixture.bytes);
      const expected = stored[fixture.id];
      ok(expected, `missing snapshot for ${fixture.id}; run pnpm test:update-snapshots in fixtures`);
      deepStrictEqual(current, expected);
    });
  }
});
