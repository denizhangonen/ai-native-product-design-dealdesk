import { getConfig } from "@/config";
import type { DiscountRequest } from "@/domain/request";
import { approvalRequestEmail, clarificationEmail } from "@/integrations/email/messages";
import { getEmailProvider } from "@/integrations/email/provider";

async function sendTo(
  to: string,
  content: { subject: string; text: string },
  idempotencyKey: string,
): Promise<void> {
  const config = getConfig();
  await getEmailProvider().send({
    to,
    from: config.EMAIL_FROM,
    // Replies come back to the address the inbound webhook listens on.
    replyTo: config.EMAIL_REPLY_TO,
    subject: content.subject,
    text: content.text,
    idempotencyKey,
  });
}

export async function sendApprovalRequest(request: DiscountRequest): Promise<void> {
  const approvers = getConfig().FINANCE_APPROVERS;
  if (approvers.length === 0) {
    console.warn({
      event: "no_approvers_configured",
      reference: request.reference,
    });
    return;
  }
  await Promise.all(
    approvers.map((approver) =>
      sendTo(approver, approvalRequestEmail(request), `approval:${request.reference}:${approver}`),
    ),
  );
}

/** Keyed by the reply being answered, so two unclear replies still get two answers. */
export async function sendClarification(
  request: DiscountRequest,
  to: string,
  inReplyTo: string,
): Promise<void> {
  await sendTo(to, clarificationEmail(request), `clarify:${inReplyTo}`);
}
