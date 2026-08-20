import { parseRequest } from "@/ai/parseRequest";
import type { SlackConfig } from "@/config";
import { getConfig } from "@/config";
import {
  linkRequest,
  markInboundMessageProcessed,
  recordInboundMessage,
} from "@/data/inboundMessages";
import { sendApprovalRequest } from "@/integrations/email/send";
import { getUserName, postMessage } from "@/integrations/slack/client";
import type { SlackMessage } from "@/integrations/slack/events";
import { needMoreDetail, notUnderstood, understood } from "@/integrations/slack/replies";
import { submitRequest } from "@/services/submitRequest";

export type HandleResult = "submitted" | "needs_detail" | "not_understood" | "duplicate";

export async function handleSlackMessage(
  message: SlackMessage,
  slack: SlackConfig,
): Promise<HandleResult> {
  if ((await recordInboundMessage(message)) === "duplicate") return "duplicate";

  // Slack expects an answer within three seconds, so the model call and the name
  // lookup run together rather than one after the other.
  const [outcome, displayName] = await Promise.all([
    parseRequest(message.text),
    resolveDisplayName(slack, message.slackUserId),
  ]);

  if (outcome.kind === "unreadable") {
    await reply(slack, message, notUnderstood());
    await markInboundMessageProcessed(message.eventId);
    return "not_understood";
  }

  if (outcome.kind === "incomplete") {
    await reply(slack, message, needMoreDetail(outcome.missing));
    await markInboundMessageProcessed(message.eventId);
    return "needs_detail";
  }

  const { customer, amount, currency, discountPercent, reason, rationale, confidence } =
    outcome.extraction;

  const { request, routing } = await submitRequest({
    requester: { slackUserId: message.slackUserId, displayName },
    customer,
    amountCents: Math.round(amount * 100),
    currency: currency ?? getConfig().DEFAULT_CURRENCY,
    discountPercent,
    reason,
    reading: { confidence, rationale, model: outcome.model },
  });

  // Marked done as soon as the request exists: a later failure must not cause a
  // retry to create the same request twice.
  await linkRequest(message.eventId, request.id);
  await markInboundMessageProcessed(message.eventId);

  if (routing.route === "finance") {
    // The request is already saved, so a mail outage delays approval, it does not lose it.
    try {
      await sendApprovalRequest(request);
    } catch (error) {
      console.error({
        event: "approval_email_failed",
        reference: request.reference,
        name: (error as Error).name,
      });
    }
  }

  await reply(slack, message, understood(request, routing));

  return "submitted";
}

/** A display name is presentation only, so losing it must not cost us the request. */
async function resolveDisplayName(slack: SlackConfig, slackUserId: string): Promise<string> {
  try {
    return await getUserName(slack.botToken, slackUserId);
  } catch (error) {
    console.warn({
      event: "slack_user_lookup_failed",
      name: (error as Error).name,
    });
    return slackUserId;
  }
}

function reply(slack: SlackConfig, message: SlackMessage, text: string): Promise<void> {
  return postMessage({
    botToken: slack.botToken,
    channel: message.channelId,
    text,
    threadTs: message.messageTs,
  });
}
