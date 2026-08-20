import { type SlackConfig, getSlackConfig } from "@/config";
import { clientKey, isRateLimited } from "@/guards/rateLimit";
import { verifySlackSignature } from "@/guards/slackSignature";
import { type SlackMessage, classifyDelivery } from "@/integrations/slack/events";
import { postMessage } from "@/integrations/slack/client";
import { somethingWentWrong } from "@/integrations/slack/replies";
import { handleSlackMessage } from "@/services/handleSlackMessage";

// Slack retries at most a handful of times per event; anything near this is not Slack.
const RATE_LIMIT = { limit: 120, windowMs: 60_000 };

export async function POST(request: Request) {
  if (isRateLimited(clientKey(request), RATE_LIMIT)) {
    console.warn({ event: "slack_rate_limited" });
    return Response.json({ ok: false }, { status: 429 });
  }

  const slack = getSlackConfig();
  if (!slack) {
    console.error({ event: "slack_not_configured" });
    return Response.json({ ok: false }, { status: 503 });
  }

  // The raw body is what was signed, so it must be read before parsing.
  const body = await request.text();
  const verified = verifySlackSignature({
    body,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
    signingSecret: slack.signingSecret,
  });

  if (!verified) {
    console.warn({ event: "slack_signature_rejected" });
    return Response.json({ ok: false }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const intake = classifyDelivery(payload, slack.channelId);

  if (intake.kind === "challenge") return Response.json({ challenge: intake.challenge });

  if (intake.kind !== "message") {
    console.info({
      event: "slack_delivery_skipped",
      kind: intake.kind,
      reason: intake.reason,
    });
    return Response.json({ ok: true });
  }

  try {
    const result = await handleSlackMessage(intake.message, slack);
    console.info({
      event: "slack_message_handled",
      result,
      eventId: intake.message.eventId,
    });
  } catch (error) {
    // Answer 200 regardless: a Slack retry would either be discarded as a
    // duplicate or hit the same outage. Tell the person instead.
    console.error({
      event: "slack_message_failed",
      eventId: intake.message.eventId,
      name: (error as Error).name,
    });
    await apologise(slack, intake.message);
  }

  return Response.json({ ok: true });
}

async function apologise(slack: SlackConfig, message: SlackMessage): Promise<void> {
  try {
    await postMessage({
      botToken: slack.botToken,
      channel: message.channelId,
      text: somethingWentWrong(),
      threadTs: message.messageTs,
    });
  } catch {
    // Slack itself is down; the error above is already logged.
  }
}
