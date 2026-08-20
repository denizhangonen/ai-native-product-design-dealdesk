import { describe, expect, it } from "vitest";
import { classifyDelivery } from "@/integrations/slack/events";

const CHANNEL = "C_SALES";

function delivery(event: Record<string, unknown>) {
  return {
    type: "event_callback",
    event_id: "Ev123",
    team_id: "T1",
    event: {
      type: "message",
      channel: CHANNEL,
      user: "U1",
      ts: "1699999999.000100",
      ...event,
    },
  };
}

describe("classifyDelivery", () => {
  it("answers the url verification challenge", () => {
    const result = classifyDelivery(
      { type: "url_verification", challenge: "abc123", token: "legacy" },
      CHANNEL,
    );
    expect(result).toEqual({ kind: "challenge", challenge: "abc123" });
  });

  it("accepts a plain message from a person", () => {
    const result = classifyDelivery(delivery({ text: "  20% off for Acme  " }), CHANNEL);

    expect(result).toEqual({
      kind: "message",
      message: {
        eventId: "Ev123",
        channelId: CHANNEL,
        slackUserId: "U1",
        messageTs: "1699999999.000100",
        text: "20% off for Acme",
      },
    });
  });

  it.each([
    ["a message from a bot", { text: "hello", bot_id: "B1" }],
    ["an edited message", { text: "hello", subtype: "message_changed" }],
    ["a channel join notice", { text: "joined", subtype: "channel_join" }],
    ["a message in another channel", { text: "hello", channel: "C_RANDOM" }],
    ["a reply inside a thread", { text: "hello", thread_ts: "1699999999.000001" }],
    ["a message with no text", { text: "   " }],
    ["a message with no author", { text: "hello", user: undefined }],
  ])("ignores %s", (_label, event) => {
    expect(classifyDelivery(delivery(event), CHANNEL).kind).toBe("ignored");
  });

  it("ignores an event type it does not handle", () => {
    const payload = {
      type: "event_callback",
      event_id: "Ev1",
      event: { type: "reaction_added" },
    };
    const result = classifyDelivery(payload, CHANNEL);
    expect(result).toEqual({
      kind: "ignored",
      reason: "event type reaction_added",
    });
  });

  it.each([
    ["an empty object", {}],
    ["a string", "not a payload"],
    ["null", null],
    ["an unknown envelope type", { type: "something_else" }],
    ["an event callback with no event id", { type: "event_callback", event: { type: "message" } }],
  ])("marks %s unreadable", (_label, payload) => {
    expect(classifyDelivery(payload, CHANNEL).kind).toBe("unreadable");
  });

  it("does not react to its own acknowledgement", () => {
    const ownReply = delivery({
      text: "Got it, looking at this.",
      bot_id: "B_DEALDESK",
      thread_ts: "1699999999.000100",
    });
    expect(classifyDelivery(ownReply, CHANNEL).kind).toBe("ignored");
  });
});
