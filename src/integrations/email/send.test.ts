import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeadlineRequest } from "@/domain/request";
import { clearOutbox, readOutbox } from "@/integrations/email/providers/fake";
import { sendApprovalRequest, sendClarification } from "@/integrations/email/send";

const config = {
  EMAIL_PROVIDER: "fake",
  EMAIL_FROM: "Dealdesk <dealdesk@example.com>",
  EMAIL_REPLY_TO: "replies@example.com",
  APPROVER_EMAILS: ["lead@example.com"],
};

vi.mock("@/config", () => ({ getConfig: () => config }));

const REQUEST: DeadlineRequest = {
  id: "req-1",
  reference: "DD-1042",
  requester: { slackUserId: "U1", displayName: "Dee Manager" },
  supplier: "Meridian Supply",
  event: "RFP-2041",
  extensionDays: 5,
  reason: "their plant lost power",
  status: "pending_lead",
  approverRole: "sourcing_lead",
  reading: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

beforeEach(() => {
  clearOutbox();
  config.APPROVER_EMAILS = ["lead@example.com"];
});

describe("sendApprovalRequest", () => {
  it("carries the reference in the subject so a reply can be matched back", async () => {
    await sendApprovalRequest(REQUEST);

    const [sent] = readOutbox();
    expect(sent.subject).toBe("[DD-1042] Deadline extension: Meridian Supply, RFP-2041, 5 days");
  });

  it("points replies at the inbound address, not the sender", async () => {
    await sendApprovalRequest(REQUEST);

    const [sent] = readOutbox();
    expect(sent.from).toBe("Dealdesk <dealdesk@example.com>");
    expect(sent.replyTo).toBe("replies@example.com");
    expect(sent.to).toBe("lead@example.com");
  });

  it("states the facts an approver needs and how to answer", async () => {
    await sendApprovalRequest(REQUEST);

    const [sent] = readOutbox();
    expect(sent.text).toContain("Meridian Supply");
    expect(sent.text).toContain("RFP-2041");
    expect(sent.text).toContain("5 days");
    expect(sent.text).toContain("their plant lost power");
    expect(sent.text).toMatch(/reply approve or reject/i);
  });

  it("says so when a request has no reason", async () => {
    await sendApprovalRequest({ ...REQUEST, reason: null });
    expect(readOutbox()[0].text).toContain("not given");
  });

  it("mails every configured approver", async () => {
    config.APPROVER_EMAILS = ["lead@example.com", "cpo@example.com"];

    await sendApprovalRequest(REQUEST);

    expect(readOutbox().map((email) => email.to)).toEqual([
      "lead@example.com",
      "cpo@example.com",
    ]);
  });

  it("sends nothing when no approver is configured", async () => {
    config.APPROVER_EMAILS = [];

    await sendApprovalRequest(REQUEST);

    expect(readOutbox()).toHaveLength(0);
  });
});

describe("sendClarification", () => {
  it("keeps the reference and asks for a plain answer", async () => {
    await sendClarification(REQUEST, "lead@example.com", "msg-1");

    const [sent] = readOutbox();
    expect(sent.subject).toContain("DD-1042");
    expect(sent.text).toMatch(/approve or reject/i);
    expect(sent.text).toContain("nothing has changed");
  });

  it("keys each clarification to the reply it answers", async () => {
    await sendClarification(REQUEST, "lead@example.com", "msg-1");
    await sendClarification(REQUEST, "lead@example.com", "msg-2");

    const keys = readOutbox().map((sent) => sent.idempotencyKey);
    expect(keys).toEqual(["clarify:msg-1", "clarify:msg-2"]);
  });
});
