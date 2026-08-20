import type { RequiredField } from "@/ai/schemas";
import { describeMissing } from "@/ai/schemas";
import { type DiscountRequest, formatAmount } from "@/domain/request";
import type { RoutingDecision } from "@/domain/rules";

const EXAMPLE = "Something like: 20% off for Acme, 48k, renewal at risk.";

/** Says back what was understood, so a misread is obvious immediately. */
export function understood(request: DiscountRequest, routing: RoutingDecision): string {
  const summary = `Understood: ${request.discountPercent}% off for ${request.customer}, ${formatAmount(request)}.`;
  const outcome =
    routing.route === "finance"
      ? `${routing.reason}. Sent to finance.`
      : `${routing.reason}, so it is approved.`;

  return `${summary}\n${outcome}\nReference ${request.reference}.`;
}

export function needMoreDetail(missing: RequiredField[]): string {
  return `Almost there, I could not find ${describeMissing(missing)}. ${EXAMPLE}`;
}

export function somethingWentWrong(): string {
  return "Something went wrong on my side and your request was not saved. Please try again in a minute.";
}

export function notUnderstood(): string {
  return `I could not read that as a discount request. ${EXAMPLE}`;
}

/** The outcome, in the thread where the rep asked. */
export function decided(request: DiscountRequest, note: string | null): string {
  const verdict =
    request.status === "approved"
      ? `Approved by finance: ${request.discountPercent}% off for ${request.customer}.`
      : `Rejected by finance: ${request.discountPercent}% off for ${request.customer}.`;

  return note ? `${verdict}\nNote: ${note}` : verdict;
}
