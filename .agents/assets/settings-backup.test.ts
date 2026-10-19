import { test } from "node:test";
import assert from "node:assert/strict";
import { backupStep, mergeBackupRecords, type BackupRecord } from "./settings-backup.ts";

const FROM = "/home/p/.claude/settings.json";
const TO = ".workshop/backups/.claude__settings.json";
const NOW = "2026-10-19T15:28:36.232Z";
const step = (o: Partial<Parameters<typeof backupStep>[0]>) => backupStep({ from: FROM, to: TO, known: [], sourceExists: true, backupFileTime: null, now: NOW, ...o });

test("a recorded backup is kept, even when the settings file changed since", () => {
  const record: BackupRecord = { from: FROM, to: TO, at: "2026-10-18T19:45:00.000Z" };
  assert.deepEqual(step({ known: [record], backupFileTime: NOW }), { kind: "keep", record });
});

test("a backup file without a record is adopted, never overwritten", () => {
  const s = step({ backupFileTime: "2026-10-18T19:45:00.000Z" });
  assert.equal(s.kind, "adopt");
  assert.deepEqual(s.record, { from: FROM, to: TO, at: "2026-10-18T19:45:00.000Z" });
});

test("a recorded missing file stays missing after the workshop creates it", () => {
  const record: BackupRecord = { from: FROM, to: null, at: "2026-10-18T19:45:00.000Z" };
  assert.equal(step({ known: [record], sourceExists: true }).kind, "keep");
});

test("a missing file with no backup is recorded as absent", () => {
  assert.deepEqual(step({ sourceExists: false }), { kind: "absent", record: { from: FROM, to: null, at: NOW } });
});

test("a file with no backup and no record is copied", () => {
  assert.deepEqual(step({}), { kind: "copy", record: { from: FROM, to: TO, at: NOW } });
});

test("merged records keep the first one per file", () => {
  const a: BackupRecord = { from: FROM, to: TO, at: "first" };
  const b: BackupRecord = { from: FROM, to: TO, at: "second" };
  const c: BackupRecord = { from: "/home/p/.cursor/hooks.json", to: null, at: "third" };
  assert.deepEqual(mergeBackupRecords([a], [b, c]), [a, c]);
  assert.deepEqual(mergeBackupRecords([], []), []);
});
