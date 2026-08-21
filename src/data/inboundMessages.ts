import { type Executor, db } from "@/data/db";
import { type Intake, claimExisting } from "@/data/intakeClaim";
import type { SlackMessage } from "@/integrations/slack/events";

export type { Intake };

/**
 * Stores a delivery once and says whether this caller owns it. Slack redelivers an
 * event it thinks we missed, so the answer must tell a dead attempt from a slow one.
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

  return claimExisting("inbound_messages", message.eventId, sql);
}

/** The request a delivery already produced, so a retry does not create a second one. */
export async function findLinkedRequest(
  eventId: string,
  sql: Executor = db(),
): Promise<string | null> {
  const [row] = await sql<{ request_id: string | null }[]>`
    select request_id from inbound_messages where event_id = ${eventId}
  `;
  return row?.request_id ?? null;
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
