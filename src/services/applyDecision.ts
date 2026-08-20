import { db } from "@/data/db";
import { appendEvent } from "@/data/events";
import { getRequestForUpdate, updateStatus } from "@/data/requests";
import { RequestNotFound } from "@/domain/errors";
import type { DiscountRequest } from "@/domain/request";
import { transition } from "@/domain/status";

export type Decision = "approve" | "reject";

export type ApplyDecisionInput = {
  requestId: string;
  decision: Decision;
  actor: string;
  note?: string | null;
};

const RESULT_OF: Record<Decision, "approved" | "rejected"> = {
  approve: "approved",
  reject: "rejected",
};

export type ApplyDecisionResult = {
  request: DiscountRequest;
  /** False when the same decision had already been applied. */
  changed: boolean;
};

export async function applyDecision(input: ApplyDecisionInput): Promise<ApplyDecisionResult> {
  // Read, decide and write in one transaction under a row lock. Reading first and
  // writing after would let two replies each act on the same stale status.
  const result = await db().begin<ApplyDecisionResult>(async (tx) => {
    const existing = await getRequestForUpdate(input.requestId, tx);
    if (!existing) throw new RequestNotFound(input.requestId);

    // Replaying the same decision is a no-op, so a duplicate email cannot double-record it.
    if (existing.status === RESULT_OF[input.decision]) return { request: existing, changed: false };

    const event = input.decision === "approve" ? "finance_approved" : "finance_rejected";
    const status = transition(existing.status, event);

    const updated = await updateStatus(existing.id, status, existing.approverRole, tx);

    await appendEvent(
      {
        requestId: updated.id,
        type: event,
        actor: input.actor,
        payload: input.note ? { note: input.note } : {},
      },
      tx,
    );

    return { request: updated, changed: true };
  });

  if (result.changed) {
    console.info({
      event: "decision_applied",
      reference: result.request.reference,
      status: result.request.status,
    });
  }
  return result;
}
