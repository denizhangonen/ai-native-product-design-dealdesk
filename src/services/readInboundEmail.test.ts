import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInbound } from "@/guards/emailSignature";
import { signResend } from "@/guards/resendSignature";
import { readInboundEmail } from "@/services/readInboundEmail";

const WEBHOOK_SECRET = `whsec_${Buffer.from("resend-test-secret").toString("base64")}`;
const OWN_SECRET = "own-relay-secret";
const API_KEY = "re_test_key";

const config = {
  EMAIL_PROVIDER: "resend",
  EMAIL_INBOUND_SECRET: OWN_SECRET,
  RESEND_API_KEY: API_KEY,
  RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET,
};

vi.mock("@/config", () => ({ getConfig: () => config }));

function resendHeaders(body: string, id = "msg_1"): Headers {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return new Headers({
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signResend(body, id, timestamp, WEBHOOK_SECRET)}`,
  });
}

function received(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "email.received",
    data: {
      email_id: "abc-123",
      from: "lead@example.com",
      subject: "Re: [DD-1] Deadline extension",
      ...over,
    },
  });
}

function stubContent(body: {
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string>;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }),
  );
}

beforeEach(() => {
  config.EMAIL_PROVIDER = "resend";
  config.RESEND_API_KEY = API_KEY;
  config.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
  config.EMAIL_INBOUND_SECRET = OWN_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("readInboundEmail with Resend", () => {
  it("reads a signed delivery and fetches the body", async () => {
    const body = received();
    stubContent({ text: "approved" });

    const read = await readInboundEmail(body, resendHeaders(body));

    expect(read).toEqual({
      kind: "ok",
      email: {
        messageId: "abc-123",
        from: "lead@example.com",
        subject: "Re: [DD-1] Deadline extension",
        body: "approved",
      },
    });
  });

  it("falls back to the HTML part when there is no plain text", async () => {
    const body = received();
    stubContent({
      text: null,
      html: "<p>Approved, but only for <b>Q3</b>.</p>",
    });

    const read = await readInboundEmail(body, resendHeaders(body));

    expect(read.kind === "ok" && read.email.body).toBe("Approved, but only for Q3.");
  });

  it("refuses a forged signature and never fetches the body", async () => {
    const body = received();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const headers = resendHeaders(body);
    headers.set("svix-signature", "v1,Zm9yZ2Vk");

    expect(await readInboundEmail(body, headers)).toEqual({
      kind: "unauthorised",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a delivery signed for a different body", async () => {
    const headers = resendHeaders(received());

    expect(await readInboundEmail(received({ from: "attacker@example.com" }), headers)).toEqual({
      kind: "unauthorised",
    });
  });

  it("ignores an event that is not a received email", async () => {
    const body = JSON.stringify({
      type: "email.delivered",
      data: { email_id: "a", from: "b" },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await readInboundEmail(body, resendHeaders(body))).toEqual({
      kind: "ignored",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a payload that is not JSON", "not json"],
    ["a payload with no event type", '{"data":{"email_id":"a","from":"b"}}'],
    ["a received event with no email id", '{"type":"email.received","data":{"from":"b"}}'],
  ])("reports %s as malformed", async (_label, body) => {
    expect(await readInboundEmail(body, resendHeaders(body))).toEqual({
      kind: "malformed",
    });
  });

  it("refuses a reply whose sending domain disowns it", async () => {
    const body = received({ from: "lead@example.com" });
    stubContent({
      text: "approved",
      headers: { "Authentication-Results": "amazonses.com; spf=fail; dkim=fail; dmarc=fail" },
    });

    expect(await readInboundEmail(body, resendHeaders(body))).toEqual({
      kind: "unauthenticated_sender",
    });
  });

  it("accepts a reply its sending domain vouches for", async () => {
    const body = received();
    stubContent({
      text: "approved",
      headers: { "Authentication-Results": "amazonses.com; spf=pass; dkim=pass; dmarc=pass" },
    });

    const read = await readInboundEmail(body, resendHeaders(body));

    expect(read.kind).toBe("ok");
  });

  it("caps a very long reply before anything downstream reads it", async () => {
    const body = received();
    stubContent({ text: "x".repeat(50_000) });

    const read = await readInboundEmail(body, resendHeaders(body));

    expect(read.kind === "ok" && read.email.body).toHaveLength(20_000);
  });

  it("refuses everything when the webhook secret is missing", async () => {
    config.RESEND_WEBHOOK_SECRET = "";
    const body = received();

    expect(await readInboundEmail(body, resendHeaders(body))).toEqual({
      kind: "not_configured",
    });
  });
});

describe("readInboundEmail with our own relay", () => {
  function ownHeaders(body: string): Headers {
    const timestamp = String(Math.floor(Date.now() / 1000));
    return new Headers({
      "x-dealdesk-timestamp": timestamp,
      "x-dealdesk-signature": signInbound(body, timestamp, OWN_SECRET),
    });
  }

  beforeEach(() => {
    config.EMAIL_PROVIDER = "fake";
  });

  it("reads a signed delivery", async () => {
    const body = JSON.stringify({
      messageId: "m-1",
      from: "lead@example.com",
      subject: "Re: [DD-1]",
      body: "approved",
    });

    expect(await readInboundEmail(body, ownHeaders(body))).toEqual({
      kind: "ok",
      email: {
        messageId: "m-1",
        from: "lead@example.com",
        subject: "Re: [DD-1]",
        body: "approved",
      },
    });
  });

  it("refuses a forged signature", async () => {
    const body = JSON.stringify({
      messageId: "m-1",
      from: "a@b.com",
      subject: "s",
      body: "approved",
    });
    const headers = ownHeaders(body);
    headers.set("x-dealdesk-signature", "e1=forged");

    expect(await readInboundEmail(body, headers)).toEqual({
      kind: "unauthorised",
    });
  });

  it("does not accept a Resend signature on the endpoint", async () => {
    const body = received();

    expect(await readInboundEmail(body, resendHeaders(body))).toEqual({
      kind: "unauthorised",
    });
  });
});
