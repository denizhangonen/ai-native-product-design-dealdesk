import { z } from "zod";

/**
 * What the model is allowed to return. Anything outside this shape is rejected
 * before it can reach the database or Slack.
 *
 * The model extracts only. It never states a route, a status, or an approver.
 */
export const extractionSchema = z.object({
  supplier: z.string().trim().min(1).nullable(),
  /** The sourcing event reference, e.g. RFP-2041. */
  event: z.string().trim().min(1).nullable(),
  extensionDays: z.number().int().min(1).max(365).nullable(),
  reason: z.string().trim().min(1).nullable(),
  /**
   * One line on how the message was read. Capped so it stays a note, not an essay,
   * and defaulted because it is presentation: a model that omits it must not cost
   * us an otherwise perfectly readable request.
   */
  rationale: z.string().trim().min(1).max(200).nullable().default(null),
  confidence: z.number().min(0).max(1),
});

export type Extraction = z.infer<typeof extractionSchema>;

/** An extraction that has every field a request needs. */
export type CompleteExtraction = Extraction & {
  supplier: string;
  event: string;
  extensionDays: number;
};

export const REQUIRED_FIELDS = ["supplier", "event", "extensionDays"] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

const LABELS: Record<RequiredField, string> = {
  supplier: "which supplier",
  event: "the sourcing event",
  extensionDays: "how many days",
};

/** Code decides what is missing, not the model. */
export function missingFields(extraction: Extraction): RequiredField[] {
  return REQUIRED_FIELDS.filter((field) => extraction[field] === null);
}

export function describeMissing(fields: RequiredField[]): string {
  return fields.map((field) => LABELS[field]).join(" and ");
}

/**
 * What the model may say about an approver's reply. It reports what was written;
 * whether that transition is legal is decided by the domain, not here.
 */
export const decisionSchema = z.object({
  decision: z.enum(["approve", "reject", "unclear"]),
  note: z.string().trim().min(1).nullable(),
  counterDays: z.number().int().min(0).max(365).nullable(),
  confidence: z.number().min(0).max(1),
});

export type DecisionReading = z.infer<typeof decisionSchema>;
