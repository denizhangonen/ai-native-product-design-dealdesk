import { type Executor, db } from "@/data/db";
import type { Intake } from "@/data/inboundMessages";

export type InboundEmailRecord = {
  messageId: string;
  fromAddress: string;
  subject: string;
  reference: string | null;
};

/**
 * Stores a reply once. A redelivery is only refused when the first attempt ran to
 * completion, so an approval whose first attempt failed is not dropped in silence.
 */
export async function recordInboundEmail(
  email: InboundEmailRecord,
  sql: Executor = db(),
): Promise<Intake> {
  const inserted = await sql`
    insert into inbound_emails (message_id, from_address, subject, reference)
    values (${email.messageId}, ${email.fromAddress}, ${email.subject}, ${email.reference})
    on conflict (message_id) do nothing
    returning id
  `;
  if (inserted.length > 0) return "new";

  const [existing] = await sql<{ processed_at: Date | null }[]>`
    select processed_at from inbound_emails where message_id = ${email.messageId}
  `;
  return existing?.processed_at ? "duplicate" : "retry";
}

export async function markInboundEmailProcessed(
  messageId: string,
  sql: Executor = db(),
): Promise<void> {
  await sql`update inbound_emails set processed_at = now() where message_id = ${messageId}`;
}
