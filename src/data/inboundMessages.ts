import { type Executor, db } from "@/data/db";
import type { SlackMessage } from "@/integrations/slack/events";

/** "duplicate" means already handled; "retry" means a previous attempt did not finish. */
export type Intake = "new" | "retry" | "duplicate";

/**
 * Stores a delivery once. A redelivery is only refused when the first attempt ran
 * to completion, so a delivery that failed halfway is not lost in silence.
 */
export async function recordInboundMessage(
  message: SlackMessage,
  sql: Executor = db(),
): Promise<Intake> {
  const inserted = await sql`
    insert into inbound_messages (event_id, channel_id, slack_user_id, message_ts, text)
    values (${message.eventId}, ${message.channelId}, ${message.slackUserId},
            ${message.messageTs}, ${message.text})
    on conflict (event_id) do nothing
    returning id
  `;
  if (inserted.length > 0) return "new";

  const [existing] = await sql<{ processed_at: Date | null }[]>`
    select processed_at from inbound_messages where event_id = ${message.eventId}
  `;
  return existing?.processed_at ? "duplicate" : "retry";
}

export async function markInboundMessageProcessed(
  eventId: string,
  sql: Executor = db(),
): Promise<void> {
  await sql`update inbound_messages set processed_at = now() where event_id = ${eventId}`;
}

export async function linkRequest(
  eventId: string,
  requestId: string,
  sql: Executor = db(),
): Promise<void> {
  await sql`update inbound_messages set request_id = ${requestId} where event_id = ${eventId}`;
}

export type SlackOrigin = {
  channelId: string;
  messageTs: string;
};

/** Where to reply about a request, so the rep hears back in their own thread. */
export async function findSlackOrigin(
  requestId: string,
  sql: Executor = db(),
): Promise<SlackOrigin | null> {
  const [row] = await sql<{ channel_id: string; message_ts: string }[]>`
    select channel_id, message_ts from inbound_messages where request_id = ${requestId}
  `;
  return row ? { channelId: row.channel_id, messageTs: row.message_ts } : null;
}
