import { describe, expect, it } from "vitest";
import { type RequestRow, toDeadlineRequest } from "@/data/rows";

const ROW: RequestRow = {
  id: "req-1",
  reference: "DD-1042",
  slack_user_id: "U1",
  requester_name: "Dee Manager",
  supplier: "Meridian Supply",
  sourcing_event: "RFP-2041",
  extension_days: 5,
  reason: "their plant lost power",
  status: "pending_lead",
  approver_role: "sourcing_lead",
  parse_confidence: "0.950",
  parse_rationale: "Supplier, event and days are all stated plainly.",
  parse_model: "openai:gpt-4.1-nano",
  created_at: new Date(0),
  updated_at: new Date(0),
};

describe("toDeadlineRequest", () => {
  it("maps the columns onto the request", () => {
    const request = toDeadlineRequest(ROW);

    expect(request.supplier).toBe("Meridian Supply");
    expect(request.event).toBe("RFP-2041");
    expect(request.extensionDays).toBe(5);
    expect(request.status).toBe("pending_lead");
    expect(request.approverRole).toBe("sourcing_lead");
  });

  it("turns the numeric confidence Postgres returns as a string back into a number", () => {
    expect(toDeadlineRequest(ROW).reading?.confidence).toBe(0.95);
  });

  it("carries the model's reading", () => {
    expect(toDeadlineRequest(ROW).reading).toEqual({
      confidence: 0.95,
      rationale: "Supplier, event and days are all stated plainly.",
      model: "openai:gpt-4.1-nano",
    });
  });

  it("reports no reading for a request created before one was recorded", () => {
    const older = { ...ROW, parse_confidence: null, parse_rationale: null, parse_model: null };

    expect(toDeadlineRequest(older).reading).toBeNull();
  });

  it("keeps the reading when the model returned no note", () => {
    expect(toDeadlineRequest({ ...ROW, parse_rationale: null }).reading).toEqual({
      confidence: 0.95,
      rationale: null,
      model: "openai:gpt-4.1-nano",
    });
  });
});
