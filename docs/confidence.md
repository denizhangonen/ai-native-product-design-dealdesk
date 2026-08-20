# Confidence

Building the happy path took a fraction of the time. Most of the work, and most of the
code, is about what happens when something is wrong. This is the list, with what the
system does in each case and how that is proven.

## The rule that makes everything else safe

**The model extracts; code decides.** A language model turns a Slack message into
fields and an email reply into approve/reject/unclear. It never chooses who approves,
never changes a status, and its output is validated against a strict schema before
anything downstream sees it. The routing rule (above 15% needs finance) lives in
`src/domain/rules.ts`, a pure function with a test on the boundary. There is a test
asserting the model's output can never carry a route or a status.

## Telling the two apart

Every request records how it was read and, separately, why it was routed. The status
page shows both side by side: the model's own one-line note with the confidence and
the model name, and the rule's reason. The rule's reason is not stored prose; it is
recomputed from `decideRoute`, so what the page shows is the rule itself, not a
recollection of it.

The note is presentation only. A model that returns no note, or one too long to be a
note, loses the note and nothing else: the request is still read, routed and answered.

## Failure modes

| What goes wrong | What the system does | Proven by |
| --- | --- | --- |
| Message is not a discount request | Replies "could not read that", stores nothing | Unit test, live |
| Message is missing the customer, amount, or discount | Asks for the missing piece by name, stores nothing | Unit test, live |
| Model returns prose, a code fence, or truncated JSON | One retry, then treated as not understood | Unit test |
| Model returns a discount of 120% or a negative amount | Rejected by schema, treated as not understood | Unit test |
| Model is unsure (low confidence) | Treated as not understood rather than guessed | Unit test |
| Model times out | Gives up after 10 seconds, replies in thread | Unit test |
| Slack delivers the same event twice | Second delivery is a no-op (unique `event_id`) | Unit test, live |
| Request with a forged Slack signature | 401, nothing read | Unit test, live |
| Captured Slack request replayed later | Rejected after five minutes | Unit test |
| Slack name lookup fails | Request is still created, Slack ID used as the name | Unit test, found live |
| Database is down during a Slack request | Health reports it; person told in thread to retry | Unit test |
| Approval email cannot be sent | Request is already saved; failure logged, not lost | Code path |
| Reply from someone who is not an approver | Ignored and logged, before the model ever reads it | Unit test, live |
| Reply whose display name impersonates an approver | Refused: only the real address counts | Unit test, live |
| Reply from a malformed From header | Refused outright, never salvaged into an address | Unit test |
| No approvers configured | Nobody can approve (fails closed) | Unit test |
| Reply is ambiguous ("what's the renewal date?") | Clarification email, state unchanged | Unit test, live |
| Reply offers a smaller discount | Recorded as a rejection with the counter offer | Unit test, live |
| Same reply email redelivered | No-op (unique `message_id`) | Unit test, live |
| A delivery fails halfway through | Not marked handled, so a redelivery retries it | Unit test |
| Two approvers reply at the same moment | Row lock: one wins, the other is refused | Two-connection test |
| A 50,000 character message or reply | Truncated to 2,000 characters before the model | Unit test |
| Model returns no note on how it read the message | The request is unaffected; the note is left empty | Unit test |
| Model returns a note longer than 200 characters | Rejected by schema, treated as not understood | Unit test |
| Second reply contradicts the first | First decision stands | Unit test, live |
| Reply references a request that does not exist | Ignored and logged | Unit test, live |
| Reply with a forged webhook signature | 401, the body is never fetched | Unit test, live |
| Delivery signed for a different body | 401 | Unit test |
| Captured delivery replayed later | Rejected after five minutes | Unit test |
| A delivery that is not a received email | Acknowledged and ignored | Unit test, live |
| Reply that arrives as HTML with no plain text | Converted to text before it is read | Unit test |
| Reply forging an approver's From address | Refused: the sending domain's own verdict decides | Unit test |
| Stranger emails the public approval address | Refused before a row is written or the model reads it | Unit test, live |
| Mail provider rotates its signing key | Both keys are accepted while the old one lives | Unit test |
| Approval email sent twice by a retry | Idempotency key makes it one email | Unit test |
| Rep cannot be notified in Slack | Decision is already recorded; failure logged | Unit test |
| One caller floods an inbound route | 429 after 120 requests a minute, per caller | Unit test |
| Status page asked for a malformed reference | 404 | Live |

"Live" means exercised against the deployed application with real signed requests.

## What a reader of the public page cannot see

The status page has no login, so it shows no requester names, no email addresses, no
justifications given by the representative, and no approver notes. It shows references,
synthetic customer names, amounts, percentages, statuses, times, and the model's
one-line note on how it read the message.

That note is written by a model about a message this project does not control, which is
why every message here is synthetic. A real deployment would put this page behind a
login before showing it.

## What is logged

One structured line per inbound delivery and per state change, carrying the request
reference and an outcome. Never a message body, an email body, a token, or a
connection string. A driver error is logged by code, not by message, because the
message can carry the connection string.

## Known limits

- The rate limit is per serverless instance, so it bounds abuse of one instance rather
  than the whole deployment. It stops a runaway client, not a determined one.
- The public list page is rebuilt at most every five seconds, so a shared link cannot
  open a database connection per visitor. A decision can take that long to appear.
- Slack expects an answer within three seconds. The model call usually fits; when it does
  not, Slack retries and the retry is discarded as a duplicate. The person still gets
  their reply from the first attempt.
- Mail is sent and received through Resend on a subdomain of its own, so the approval
  address is separate from any real mailbox. The signature check is Resend's; the
  application's own scheme is still there for local runs with no mail account.
- A delivery carries metadata only, so the reply body is fetched afterwards. That fetch
  happens only once the signature is trusted, and the body is capped before it is read.
