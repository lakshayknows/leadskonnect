/**
 * Tamper-evident compliance ledger (product PRD §12 differentiator) — an append-only,
 * hash-chained log of consent/suppression events. Each entry's hash is computed over the
 * entry itself PLUS the previous entry's hash, so altering (or deleting) any past entry
 * changes what every later hash should be — verifyLedger() below is how that surfaces.
 * A regular database row can be quietly edited; this can only be quietly BROKEN, and
 * breakage is detectable.
 */
import crypto from "node:crypto";
import { prisma } from "./db";

const GENESIS = "genesis";

function computeHash(prevHash: string, entry: { organizationId: string; sequence: number; eventType: string; payload: unknown; createdAt: string }): string {
  return crypto.createHash("sha256").update(prevHash + JSON.stringify(entry)).digest("hex");
}

/**
 * Append one entry. Reads the last row and inserts inside one transaction so two
 * concurrent appends for the same org can't compute the same sequence/prevHash pair.
 */
export async function appendLedgerEntry(organizationId: string, eventType: string, payload: Record<string, unknown>) {
  return prisma.$transaction(async (tx) => {
    const last = await tx.complianceLedgerEntry.findFirst({
      where: { organizationId },
      orderBy: { sequence: "desc" },
    });
    const sequence = (last?.sequence ?? 0) + 1;
    const prevHash = last?.hash ?? GENESIS;
    const createdAt = new Date();
    const hash = computeHash(prevHash, { organizationId, sequence, eventType, payload, createdAt: createdAt.toISOString() });
    return tx.complianceLedgerEntry.create({
      data: { organizationId, sequence, eventType, payload: payload as object, prevHash, hash, createdAt },
    });
  });
}

/** Walks the whole chain and recomputes every hash — confirms nothing was altered after
 *  the fact. Returns the sequence number where the chain first breaks, if it does. */
export async function verifyLedger(organizationId: string): Promise<{ ok: boolean; entries: number; brokenAtSequence: number | null }> {
  const entries = await prisma.complianceLedgerEntry.findMany({
    where: { organizationId },
    orderBy: { sequence: "asc" },
  });

  let prevHash = GENESIS;
  for (const e of entries) {
    const expected = computeHash(prevHash, {
      organizationId,
      sequence: e.sequence,
      eventType: e.eventType,
      payload: e.payload as Record<string, unknown>,
      createdAt: e.createdAt.toISOString(),
    });
    if (e.prevHash !== prevHash || e.hash !== expected) {
      return { ok: false, entries: entries.length, brokenAtSequence: e.sequence };
    }
    prevHash = e.hash;
  }
  return { ok: true, entries: entries.length, brokenAtSequence: null };
}
