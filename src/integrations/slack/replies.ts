import type { RequiredField } from "@/ai/schemas";
import { describeMissing } from "@/ai/schemas";
import { type DeadlineRequest, formatExtension } from "@/domain/request";
import type { RoutingDecision } from "@/domain/rules";

const EXAMPLE = "Something like: Meridian Supply asked for 2 more days on RFP-2041, their plant lost power.";

function summary(request: DeadlineRequest): string {
  return `${formatExtension(request.extensionDays)} more for ${request.supplier} on ${request.event}`;
}

/** Says back what was understood, so a misread is obvious immediately. */
export function understood(request: DeadlineRequest, routing: RoutingDecision): string {
  const outcome =
    routing.route === "lead"
      ? `${routing.reason}. Sent to the sourcing lead.`
      : `${routing.reason}, so it is approved.`;

  return `Understood: ${summary(request)}.\n${outcome}\nReference ${request.reference}.`;
}

export function needMoreDetail(missing: RequiredField[]): string {
  return `Almost there, I could not find ${describeMissing(missing)}. ${EXAMPLE}`;
}

export function somethingWentWrong(): string {
  return "Something went wrong on my side and your request was not saved. Please try again in a minute.";
}

export function notUnderstood(): string {
  return `I could not read that as a deadline extension request. ${EXAMPLE}`;
}

/** The outcome, in the thread where the manager asked. */
export function decided(request: DeadlineRequest, note: string | null): string {
  const verdict =
    request.status === "approved"
      ? `Approved by the sourcing lead: ${summary(request)}.`
      : `Rejected by the sourcing lead: ${summary(request)}.`;

  return note ? `${verdict}\nNote: ${note}` : verdict;
}
