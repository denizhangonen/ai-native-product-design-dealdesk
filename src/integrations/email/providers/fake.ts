import { maskAddress } from "@/integrations/email/mask";
import type { EmailProvider, OutboundEmail } from "@/integrations/email/provider";

/**
 * A stand-in for a mail service, so the flow can be exercised with no domain and
 * no account. Sent mail is kept in memory for tests and logged by subject only.
 */
const outbox: OutboundEmail[] = [];

export function readOutbox(): readonly OutboundEmail[] {
  return outbox;
}

export function clearOutbox(): void {
  outbox.length = 0;
}

export const fakeEmailProvider: EmailProvider = {
  name: "fake",
  async send(email: OutboundEmail): Promise<void> {
    outbox.push(email);
    // Subject only: the body carries supplier detail and the address is personal.
    console.info({ event: "email_sent", to: maskAddress(email.to), subject: email.subject });
  },
};
