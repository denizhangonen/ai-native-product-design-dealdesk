import { describe, expect, it } from "vitest";
import { type RequestRow, toDiscountRequest } from "@/data/rows";

const ROW: RequestRow = {
  id: "req-1",
  reference: "DD-1042",
  slack_user_id: "U1",
  requester_name: "Dee Rep",
  customer: "Acme",
  amount_cents: "4800000",
  currency: "USD",
  discount_percent: "20.00",
  reason: "renewal at risk",
  status: "pending_finance",
  approver_role: "finance",
  parse_confidence: "0.950",
  parse_rationale: "Discount and value are both stated plainly.",
  parse_model: "openai:gpt-4.1-nano",
  created_at: new Date(0),
  updated_at: new Date(0),
};

describe("toDiscountRequest", () => {
  it("turns the numeric columns Postgres returns as strings back into numbers", () => {
    const request = toDiscountRequest(ROW);

    expect(request.amountCents).toBe(4_800_000);
    expect(request.discountPercent).toBe(20);
    expect(request.reading?.confidence).toBe(0.95);
  });

  it("carries the model's reading", () => {
    expect(toDiscountRequest(ROW).reading).toEqual({
      confidence: 0.95,
      rationale: "Discount and value are both stated plainly.",
      model: "openai:gpt-4.1-nano",
    });
  });

  it("reports no reading for a request created before one was recorded", () => {
    const older = { ...ROW, parse_confidence: null, parse_rationale: null, parse_model: null };

    expect(toDiscountRequest(older).reading).toBeNull();
  });

  it("keeps the reading when the model returned no note", () => {
    expect(toDiscountRequest({ ...ROW, parse_rationale: null }).reading).toEqual({
      confidence: 0.95,
      rationale: null,
      model: "openai:gpt-4.1-nano",
    });
  });
});
