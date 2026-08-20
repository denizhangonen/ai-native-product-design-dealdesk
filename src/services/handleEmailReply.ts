import { parseDecision } from "@/ai/parseDecision";
import { getConfig } from "@/config";
import { markInboundEmailProcessed, recordInboundEmail } from "@/data/inboundEmails";
import { getRequestByReference } from "@/data/requests";
import { InvalidTransition } from "@/domain/errors";
import { isApprover, normaliseAddress } from "@/guards/approverAllowlist";
import { extractReference, stripQuotedText } from "@/integrations/email/parseReply";
import { sendClarification } from "@/integrations/email/send";
import { applyDecision } from "@/services/applyDecision";
import { notifyRequester } from "@/services/notifyRequester";

export type InboundEmail = {
  messageId: string;
  from: string;
  subject: string;
  body: string;
};

export type EmailReplyResult =
  "applied" | "duplicate" | "not_an_approver" | "unknown_reference" | "unclear" | "already_decided";

export async function handleEmailReply(email: InboundEmail): Promise<EmailReplyResult> {
  const reference = extractReference(email.subject);
  const from = normaliseAddress(email.from);

  // Checked before anything is stored: the approval address is public, so a
  // stranger must not be able to write a row or reach the model by emailing it.
  if (!isApprover(from, getConfig().FINANCE_APPROVERS)) {
    console.warn({ event: "email_from_non_approver", reference });
    return "not_an_approver";
  }

  const intake = await recordInboundEmail({
    messageId: email.messageId,
    fromAddress: from,
    subject: email.subject,
    reference,
  });
  if (intake === "duplicate") return "duplicate";

  const finish = async (result: EmailReplyResult): Promise<EmailReplyResult> => {
    await markInboundEmailProcessed(email.messageId);
    return result;
  };

  if (!reference) return finish("unknown_reference");

  const request = await getRequestByReference(reference);
  if (!request) {
    console.warn({ event: "email_reference_unknown", reference });
    return finish("unknown_reference");
  }

  const outcome = await parseDecision(stripQuotedText(email.body));

  if (outcome.kind === "unclear") {
    console.info({
      event: "email_decision_unclear",
      reference,
      reason: outcome.reason,
    });
    await sendClarification(request, from, email.messageId);
    return finish("unclear");
  }

  const { decision, note, counterPercent } = outcome.reading;
  const fullNote =
    counterPercent === null
      ? note
      : [note, `counter offer ${counterPercent}%`].filter(Boolean).join(" - ");

  try {
    const applied = await applyDecision({
      requestId: request.id,
      decision,
      actor: from,
      note: fullNote,
    });
    if (applied.changed) await notifyRequester(applied.request, fullNote);
  } catch (error) {
    // A second reply that contradicts the first: the first one stands.
    if (error instanceof InvalidTransition) {
      console.warn({
        event: "email_decision_too_late",
        reference,
        status: request.status,
      });
      return finish("already_decided");
    }
    // Left unprocessed on purpose, so a redelivery gets another chance.
    throw error;
  }

  return finish("applied");
}
