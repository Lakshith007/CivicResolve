import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { AuditLogEntry, SessionUser } from '@/types/civic';
import { fetchAuditLogsFromFirestore, syncAuditLogToFirestore } from '@/lib/firebase';

const AUDIT_FILE_PATH = path.join(process.cwd(), 'data', 'audit-logs.json');

const globalForAudit = globalThis as unknown as {
  __civicAuditCache?: AuditLogEntry[] | null;
};

function cloneLogs(list: AuditLogEntry[]): AuditLogEntry[] {
  return JSON.parse(JSON.stringify(list)) as AuditLogEntry[];
}

function loadLogs(): AuditLogEntry[] {
  if (globalForAudit.__civicAuditCache) {
    return cloneLogs(globalForAudit.__civicAuditCache);
  }
  try {
    if (fs.existsSync(AUDIT_FILE_PATH)) {
      const raw = fs.readFileSync(AUDIT_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as AuditLogEntry[];
      if (Array.isArray(parsed)) {
        globalForAudit.__civicAuditCache = cloneLogs(parsed);
        return parsed;
      }
    }
  } catch {
    // Fallback to empty
  }
  globalForAudit.__civicAuditCache = [];
  return [];
}

function persistLogs(logs: AuditLogEntry[]): void {
  globalForAudit.__civicAuditCache = cloneLogs(logs);
  if (process.env.NODE_ENV === 'test') return;
  try {
    const dir = path.dirname(AUDIT_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(AUDIT_FILE_PATH, JSON.stringify(logs, null, 2), 'utf-8');
  } catch {
    // Graceful fallback in read-only environments
  }
}

/**
 * Append-only immutable audit log recorder.
 * Never logs passwords, session tokens, or sensitive citizen contact details.
 */
export function recordAuditLog(params: {
  actor: SessionUser;
  action: string;
  targetTicketId: string;
  previousValues?: Record<string, unknown>;
  updatedValues?: Record<string, unknown>;
  reason?: string;
}): AuditLogEntry {
  const logs = loadLogs();
  const entry: AuditLogEntry = {
    id: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    action: params.action,
    targetTicketId: params.targetTicketId,
    previousValues: params.previousValues,
    updatedValues: params.updatedValues,
    reason: params.reason,
    timestamp: new Date().toISOString(),
  };

  logs.unshift(entry);
  persistLogs(logs.slice(0, 500));
  void syncAuditLogToFirestore(entry);
  return cloneLogs([entry])[0];
}

export function getAuditLogs(limit = 50): AuditLogEntry[] {
  return loadLogs().slice(0, limit);
}

export async function hydrateAuditLogsFromFirestore(limit = 50): Promise<AuditLogEntry[]> {
  const local = loadLogs();
  const remote = await fetchAuditLogsFromFirestore();
  if (!remote || remote.length === 0) {
    return local.slice(0, limit);
  }

  const mergedMap = new Map<string, AuditLogEntry>();
  for (const l of local) mergedMap.set(l.id, l);
  for (const r of remote) mergedMap.set(r.id, r);

  const merged = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  globalForAudit.__civicAuditCache = cloneLogs(merged.slice(0, 500));
  return merged.slice(0, limit);
}

export function resetAuditStoreForTesting(): void {
  globalForAudit.__civicAuditCache = [];
}
