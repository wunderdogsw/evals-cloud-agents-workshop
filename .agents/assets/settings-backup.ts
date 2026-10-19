/** One user-level settings file and its pre-workshop copy; `to` is null when the file did not exist. */
export interface BackupRecord {
  from: string;
  to: string | null;
  at: string;
}

/**
 * What attach does with one settings file:
 * - `keep`: a record exists already, so the earlier backup stands.
 * - `adopt`: a backup file exists without a record, so it is kept and recorded, never overwritten.
 * - `absent`: the file does not exist, which is recorded so cleanup can remove it if the workshop creates it.
 * - `copy`: no backup yet, so the file is copied now.
 */
export type BackupStep = { kind: "keep" | "adopt" | "absent" | "copy"; record: BackupRecord };

/** Decide the backup step for one file from what is recorded and what exists on disk. */
export function backupStep(o: { from: string; to: string; known: BackupRecord[]; sourceExists: boolean; backupFileTime: string | null; now: string }): BackupStep {
  const recorded = o.known.find((b) => b.from === o.from);
  if (recorded) return { kind: "keep", record: recorded };
  if (o.backupFileTime) return { kind: "adopt", record: { from: o.from, to: o.to, at: o.backupFileTime } };
  if (!o.sourceExists) return { kind: "absent", record: { from: o.from, to: null, at: o.now } };
  return { kind: "copy", record: { from: o.from, to: o.to, at: o.now } };
}

/** Records from several places, one per file, the first one seen winning. */
export function mergeBackupRecords(...lists: BackupRecord[][]): BackupRecord[] {
  return lists.flat().reduce<BackupRecord[]>((all, b) => (all.some((x) => x.from === b.from) ? all : [...all, b]), []);
}
