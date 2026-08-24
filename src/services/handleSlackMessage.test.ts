import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SlackConfig } from "@/config";
import type { DeadlineRequest } from "@/domain/request";
import type { SlackMessage } from "@/integrations/slack/events";
import { handleSlackMessage } from "@/services/handleSlackMessage";

const mocks = vi.hoisted(() => ({
  recordInboundMessage: vi.fn(),
  markInboundMessageProcessed: vi.fn(),
  linkRequest: vi.fn(),
  findLinkedRequest: vi.fn(),
  postMessage: vi.fn(),
  getUserName: vi.fn(),
  parseRequest: vi.fn(),
  submitRequest: vi.fn(),
}));

vi.mock("@/data/inboundMessages", () => ({
  recordInboundMessage: mocks.recordInboundMessage,
  markInboundMessageProcessed: mocks.markInboundMessageProcessed,
  linkRequest: mocks.linkRequest,
  findLinkedRequest: mocks.findLinkedRequest,
}));
vi.mock("@/integrations/slack/client", () => ({
  postMessage: mocks.postMessage,
  getUserName: mocks.getUserName,
}));
vi.mock("@/ai/parseRequest", () => ({ parseRequest: mocks.parseRequest }));
vi.mock("@/services/submitRequest", () => ({
  submitRequest: mocks.submitRequest,
}));

const SLACK: SlackConfig = {
  signingSecret: "secret",
  botToken: "xoxb-not-a-real-token",
  channelId: "C_SOURCING",
};

const MESSAGE: SlackMessage = {
  eventId: "Ev123",
  channelId: "C_SOURCING",
  slackUserId: "U1",
  messageTs: "1699999999.000100",
  text: "Meridian Supply asked for 5 more days on RFP-2041, their plant lost power",
};

const REQUEST: DeadlineRequest = {
  id: "req-1",
  reference: "DD-1001",
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

function lastReply(): string {
  const calls = mocks.postMessage.mock.calls;
  return calls[calls.length - 1][0].text as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recordInboundMessage.mockResolvedValue("new");
  mocks.markInboundMessageProcessed.mockResolvedValue(undefined);
  mocks.linkRequest.mockResolvedValue(undefined);
  mocks.postMessage.mockResolvedValue(undefined);
  mocks.getUserName.mockResolvedValue("Dee Manager");
  mocks.submitRequest.mockResolvedValue({
    request: REQUEST,
    routing: {
      route: "lead",
      reason: "5 days is above the 3-day limit, so the sourcing lead must approve",
    },
  });
  mocks.parseRequest.mockResolvedValue({
    kind: "parsed",
    model: "fake",
    extraction: {
      supplier: "Meridian Supply",
      event: "RFP-2041",
      extensionDays: 5,
      reason: "their plant lost power",
      rationale: "Read plainly.",
      confidence: 0.95,
    },
  });
});

describe("handleSlackMessage", () => {
  it("turns an understood message into a request", async () => {
    const result = await handleSlackMessage(MESSAGE, SLACK);

    expect(result).toBe("submitted");
    expect(mocks.submitRequest).toHaveBeenCalledWith({
      requester: { slackUserId: "U1", displayName: "Dee Manager" },
      supplier: "Meridian Supply",
      event: "RFP-2041",
      extensionDays: 5,
      reason: "their plant lost power",
      // Carried through so a reader can see how sure the model was, and which model.
      reading: { confidence: 0.95, rationale: "Read plainly.", model: "fake" },
    });
    expect(mocks.linkRequest).toHaveBeenCalledWith("Ev123", "req-1");
  });

  it("says back what it understood and where it went", async () => {
    await handleSlackMessage(MESSAGE, SLACK);

    const text = lastReply();
    expect(text).toContain("5 days more for Meridian Supply on RFP-2041");
    expect(text).toContain("Sent to the sourcing lead");
    expect(text).toContain("DD-1001");
  });

  it("asks for the missing piece instead of guessing", async () => {
    mocks.parseRequest.mockResolvedValue({
      kind: "incomplete",
      extraction: {},
      missing: ["extensionDays"],
    });

    const result = await handleSlackMessage(MESSAGE, SLACK);

    expect(result).toBe("needs_detail");
    expect(lastReply()).toContain("how many days");
    expect(mocks.submitRequest).not.toHaveBeenCalled();
  });

  it("says so plainly when the message is not an extension request", async () => {
    mocks.parseRequest.mockResolvedValue({
      kind: "unreadable",
      reason: "whatever",
    });

    const result = await handleSlackMessage(MESSAGE, SLACK);

    expect(result).toBe("not_understood");
    expect(lastReply()).toContain("could not read that as a deadline extension request");
    expect(mocks.submitRequest).not.toHaveBeenCalled();
  });

  it("does nothing at all when Slack redelivers the same event", async () => {
    mocks.recordInboundMessage.mockResolvedValue("duplicate");

    const result = await handleSlackMessage(MESSAGE, SLACK);

    expect(result).toBe("duplicate");
    expect(mocks.parseRequest).not.toHaveBeenCalled();
    expect(mocks.submitRequest).not.toHaveBeenCalled();
    expect(mocks.postMessage).not.toHaveBeenCalled();
  });

  it("still creates the request when the name lookup fails", async () => {
    mocks.getUserName.mockRejectedValue(new Error("invalid_auth"));

    const result = await handleSlackMessage(MESSAGE, SLACK);

    expect(result).toBe("submitted");
    expect(mocks.submitRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requester: { slackUserId: "U1", displayName: "U1" },
      }),
    );
  });

  it("marks the delivery handled as soon as the request exists", async () => {
    await handleSlackMessage(MESSAGE, SLACK);
    expect(mocks.markInboundMessageProcessed).toHaveBeenCalledWith("Ev123");
  });

  it("retries a delivery whose first attempt died before creating anything", async () => {
    mocks.recordInboundMessage.mockResolvedValue("retry");
    mocks.findLinkedRequest.mockResolvedValue(null);

    expect(await handleSlackMessage(MESSAGE, SLACK)).toBe("submitted");
    expect(mocks.submitRequest).toHaveBeenCalled();
  });

  // Slack redelivers after three seconds, and reading a message takes longer than
  // that. One message used to become two requests this way.
  it("does nothing when a redelivery arrives while the first attempt is still running", async () => {
    mocks.recordInboundMessage.mockResolvedValue("in_flight");

    expect(await handleSlackMessage(MESSAGE, SLACK)).toBe("in_flight");
    expect(mocks.submitRequest).not.toHaveBeenCalled();
    expect(mocks.postMessage).not.toHaveBeenCalled();
    expect(mocks.markInboundMessageProcessed).not.toHaveBeenCalled();
  });

  it("does not create a second request when a dead attempt already created one", async () => {
    mocks.recordInboundMessage.mockResolvedValue("retry");
    mocks.findLinkedRequest.mockResolvedValue("req-1");

    expect(await handleSlackMessage(MESSAGE, SLACK)).toBe("duplicate");
    expect(mocks.submitRequest).not.toHaveBeenCalled();
    expect(mocks.markInboundMessageProcessed).toHaveBeenCalledWith("Ev123");
  });

  it("leaves the delivery unhandled when the request could not be created", async () => {
    mocks.submitRequest.mockRejectedValue(new Error("database unreachable"));

    await expect(handleSlackMessage(MESSAGE, SLACK)).rejects.toThrow("database unreachable");
    expect(mocks.markInboundMessageProcessed).not.toHaveBeenCalled();
  });

  it("never asks the model to decide the route", async () => {
    await handleSlackMessage(MESSAGE, SLACK);
    const [submitted] = mocks.submitRequest.mock.calls[0];
    expect(Object.keys(submitted)).not.toContain("route");
    expect(Object.keys(submitted)).not.toContain("status");
  });
});
