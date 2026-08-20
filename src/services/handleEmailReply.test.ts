import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscountRequest } from "@/domain/request";
import { InvalidTransition } from "@/domain/errors";
import { handleEmailReply } from "@/services/handleEmailReply";

const mocks = vi.hoisted(() => ({
  recordInboundEmail: vi.fn(),
  markInboundEmailProcessed: vi.fn(),
  getRequestByReference: vi.fn(),
  parseDecision: vi.fn(),
  applyDecision: vi.fn(),
  sendClarification: vi.fn(),
  notifyRequester: vi.fn(),
}));

vi.mock("@/config", () => ({
  getConfig: () => ({ FINANCE_APPROVERS: ["finance@example.com"] }),
}));
vi.mock("@/data/inboundEmails", () => ({
  recordInboundEmail: mocks.recordInboundEmail,
  markInboundEmailProcessed: mocks.markInboundEmailProcessed,
}));
vi.mock("@/data/requests", () => ({
  getRequestByReference: mocks.getRequestByReference,
}));
vi.mock("@/ai/parseDecision", () => ({ parseDecision: mocks.parseDecision }));
vi.mock("@/services/applyDecision", () => ({
  applyDecision: mocks.applyDecision,
}));
vi.mock("@/integrations/email/send", () => ({
  sendClarification: mocks.sendClarification,
}));
vi.mock("@/services/notifyRequester", () => ({
  notifyRequester: mocks.notifyRequester,
}));

const REQUEST: DiscountRequest = {
  id: "req-1",
  reference: "DD-1042",
  requester: { slackUserId: "U1", displayName: "Dee Rep" },
  customer: "Acme",
  amountCents: 4_800_000,
  currency: "USD",
  discountPercent: 20,
  reason: null,
  status: "pending_finance",
  approverRole: "finance",
  reading: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const EMAIL = {
  messageId: "msg-1",
  from: "Dee Finance <finance@example.com>",
  subject: "Re: [DD-1042] Discount approval: Acme 20%",
  body: "Approved, but only for Q3.\n\nOn Wed, Aug 20, 2026 at 10:00 AM Dealdesk wrote:\n> ...",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recordInboundEmail.mockResolvedValue("new");
  mocks.markInboundEmailProcessed.mockResolvedValue(undefined);
  mocks.getRequestByReference.mockResolvedValue(REQUEST);
  mocks.applyDecision.mockResolvedValue({
    request: { ...REQUEST, status: "approved" },
    changed: true,
  });
  mocks.notifyRequester.mockResolvedValue("notified");
  mocks.sendClarification.mockResolvedValue(undefined);
  mocks.parseDecision.mockResolvedValue({
    kind: "decided",
    reading: {
      decision: "approve",
      note: "only for Q3",
      counterPercent: null,
      confidence: 0.95,
    },
  });
});

describe("handleEmailReply", () => {
  it("applies an approval from a known approver", async () => {
    const result = await handleEmailReply(EMAIL);

    expect(result).toBe("applied");
    expect(mocks.applyDecision).toHaveBeenCalledWith({
      requestId: "req-1",
      decision: "approve",
      actor: "finance@example.com",
      note: "only for Q3",
    });
  });

  it("tells the rep in their thread once the decision is applied", async () => {
    await handleEmailReply(EMAIL);

    expect(mocks.notifyRequester).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved" }),
      "only for Q3",
    );
  });

  it("does not notify again when the decision had already been applied", async () => {
    mocks.applyDecision.mockResolvedValue({ request: REQUEST, changed: false });

    await handleEmailReply(EMAIL);

    expect(mocks.notifyRequester).not.toHaveBeenCalled();
  });

  it("reads only what was typed, not the quoted original", async () => {
    await handleEmailReply(EMAIL);
    expect(mocks.parseDecision).toHaveBeenCalledWith("Approved, but only for Q3.");
  });

  it("records a counter offer alongside the note", async () => {
    mocks.parseDecision.mockResolvedValue({
      kind: "decided",
      reading: {
        decision: "reject",
        note: "12% is the most we can do",
        counterPercent: 12,
        confidence: 0.95,
      },
    });

    await handleEmailReply(EMAIL);

    expect(mocks.applyDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "reject",
        note: "12% is the most we can do - counter offer 12%",
      }),
    );
  });

  it("ignores a reply from someone who is not an approver", async () => {
    const result = await handleEmailReply({
      ...EMAIL,
      from: "rep@example.com",
    });

    expect(result).toBe("not_an_approver");
    // The approval address is public, so a stranger must not be able to write a row.
    expect(mocks.recordInboundEmail).not.toHaveBeenCalled();
    expect(mocks.parseDecision).not.toHaveBeenCalled();
    expect(mocks.applyDecision).not.toHaveBeenCalled();
  });

  it("does not even read a stranger's message", async () => {
    await handleEmailReply({ ...EMAIL, from: "attacker@evil.com" });
    expect(mocks.getRequestByReference).not.toHaveBeenCalled();
  });

  it("asks for a plain answer when the reply is unclear, changing nothing", async () => {
    mocks.parseDecision.mockResolvedValue({
      kind: "unclear",
      reason: "reply was not a decision",
    });

    const result = await handleEmailReply(EMAIL);

    expect(result).toBe("unclear");
    expect(mocks.applyDecision).not.toHaveBeenCalled();
    expect(mocks.sendClarification).toHaveBeenCalledWith(REQUEST, "finance@example.com", "msg-1");
  });

  it("does nothing when the same message arrives twice", async () => {
    mocks.recordInboundEmail.mockResolvedValue("duplicate");

    const result = await handleEmailReply(EMAIL);

    expect(result).toBe("duplicate");
    expect(mocks.parseDecision).not.toHaveBeenCalled();
    expect(mocks.applyDecision).not.toHaveBeenCalled();
    expect(mocks.sendClarification).not.toHaveBeenCalled();
  });

  it.each([
    ["no reference in the subject", { subject: "Re: your message" }],
    ["a reference for a request that does not exist", { subject: "Re: [DD-9999] whatever" }],
  ])("reports %s", async (_label, overrides) => {
    mocks.getRequestByReference.mockResolvedValue(null);

    expect(await handleEmailReply({ ...EMAIL, ...overrides })).toBe("unknown_reference");
    expect(mocks.applyDecision).not.toHaveBeenCalled();
  });

  it("marks the reply handled once it reaches a final outcome", async () => {
    await handleEmailReply(EMAIL);
    expect(mocks.markInboundEmailProcessed).toHaveBeenCalledWith("msg-1");
  });

  it("retries a delivery whose first attempt never finished", async () => {
    mocks.recordInboundEmail.mockResolvedValue("retry");

    expect(await handleEmailReply(EMAIL)).toBe("applied");
    expect(mocks.applyDecision).toHaveBeenCalled();
  });

  it("leaves the reply unhandled when the decision fails, so a retry can work", async () => {
    mocks.applyDecision.mockRejectedValue(new Error("database unreachable"));

    await expect(handleEmailReply(EMAIL)).rejects.toThrow("database unreachable");
    expect(mocks.markInboundEmailProcessed).not.toHaveBeenCalled();
  });

  it("lets the first decision stand when a contradicting reply arrives later", async () => {
    mocks.applyDecision.mockRejectedValue(new InvalidTransition("approved", "finance_rejected"));

    const result = await handleEmailReply(EMAIL);

    expect(result).toBe("already_decided");
  });
});
