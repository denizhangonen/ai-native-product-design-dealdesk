import { type DiscountRequest, formatAmount } from "@/domain/request";

export type EmailContent = {
  subject: string;
  text: string;
};

/** The reference in the subject is how a reply finds its way back to the request. */
export function approvalRequestEmail(request: DiscountRequest): EmailContent {
  const lines = [
    `${request.requester.displayName} is asking for a discount.`,
    "",
    `Customer:   ${request.customer}`,
    `Deal value: ${formatAmount(request)}`,
    `Discount:   ${request.discountPercent}%`,
    `Reason:     ${request.reason ?? "not given"}`,
    "",
    "Reply approve or reject. Add a note if you like, and it will be passed on.",
  ];

  return {
    subject: `[${request.reference}] Discount approval: ${request.customer} ${request.discountPercent}%`,
    text: lines.join("\n"),
  };
}

export function clarificationEmail(request: DiscountRequest): EmailContent {
  return {
    subject: `[${request.reference}] Sorry, was that an approval?`,
    text: [
      "I could not tell whether that was an approval or a rejection, so nothing has changed.",
      "",
      "Reply with approve or reject and I will take it from there.",
    ].join("\n"),
  };
}
