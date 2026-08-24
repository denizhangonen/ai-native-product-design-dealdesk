import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeadlineRequest } from "@/domain/request";
import { notifyRequester } from "@/services/notifyRequester";

const mocks = vi.hoisted(() => ({
  getSlackConfig: vi.fn(),
  findSlackOrigin: vi.fn(),
  postMessage: vi.fn(),
}));

vi.mock("@/config", () => ({ getSlackConfig: mocks.getSlackConfig }));
vi.mock("@/data/inboundMessages", () => ({
  findSlackOrigin: mocks.findSlackOrigin,
}));
vi.mock("@/integrations/slack/client", () => ({
  postMessage: mocks.postMessage,
}));

const SLACK = {
  signingSecret: "s",
  botToken: "xoxb-not-a-real-token",
  channelId: "C_SOURCING",
};

const REQUEST: DeadlineRequest = {
  id: "req-1",
  reference: "DD-1042",
  requester: { slackUserId: "U1", displayName: "Dee Manager" },
  supplier: "Meridian Supply",
  event: "RFP-2041",
  extensionDays: 5,
  reason: null,
  status: "approved",
  approverRole: "sourcing_lead",
  reading: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSlackConfig.mockReturnValue(SLACK);
  mocks.findSlackOrigin.mockResolvedValue({
    channelId: "C_SOURCING",
    messageTs: "1699.0001",
  });
  mocks.postMessage.mockResolvedValue(undefined);
});

describe("notifyRequester", () => {
  it("replies in the thread where the manager asked", async () => {
    const result = await notifyRequester(REQUEST, "this is the last one");

    expect(result).toBe("notified");
    expect(mocks.postMessage).toHaveBeenCalledWith({
      botToken: SLACK.botToken,
      channel: "C_SOURCING",
      threadTs: "1699.0001",
      text: "Approved by the sourcing lead: 5 days more for Meridian Supply on RFP-2041.\nNote: this is the last one",
    });
  });

  it("words a rejection plainly", async () => {
    await notifyRequester({ ...REQUEST, status: "rejected" }, "2 days is the most we can give");

    expect(mocks.postMessage.mock.calls[0][0].text).toBe(
      "Rejected by the sourcing lead: 5 days more for Meridian Supply on RFP-2041.\nNote: 2 days is the most we can give",
    );
  });

  it("leaves the note line out when there is no note", async () => {
    await notifyRequester(REQUEST, null);
    expect(mocks.postMessage.mock.calls[0][0].text).toBe(
      "Approved by the sourcing lead: 5 days more for Meridian Supply on RFP-2041.",
    );
  });

  it("does nothing when Slack is not configured", async () => {
    mocks.getSlackConfig.mockReturnValue(null);

    expect(await notifyRequester(REQUEST, null)).toBe("slack_not_configured");
    expect(mocks.postMessage).not.toHaveBeenCalled();
  });

  it("reports a request that did not come from Slack", async () => {
    mocks.findSlackOrigin.mockResolvedValue(null);

    expect(await notifyRequester(REQUEST, null)).toBe("no_origin");
    expect(mocks.postMessage).not.toHaveBeenCalled();
  });

  it("swallows a Slack failure, because the decision is already recorded", async () => {
    mocks.postMessage.mockRejectedValue(new Error("slack is down"));

    await expect(notifyRequester(REQUEST, null)).resolves.toBe("failed");
  });
});
