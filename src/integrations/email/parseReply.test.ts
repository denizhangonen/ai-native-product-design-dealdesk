import { describe, expect, it } from "vitest";
import { extractReference, stripQuotedText } from "@/integrations/email/parseReply";

describe("extractReference", () => {
  it.each([
    ["[DD-1042] Deadline extension: Meridian Supply, RFP-2041, 5 days", "DD-1042"],
    ["Re: [DD-1042] Deadline extension: Meridian Supply, RFP-2041, 5 days", "DD-1042"],
    ["RE: RE: FW: [DD-9] Deadline extension", "DD-9"],
    ["Antwort: [DD-1042] Rabatt", "DD-1042"],
  ])("finds the reference in %s", (subject, expected) => {
    expect(extractReference(subject)).toBe(expected);
  });

  it.each(["Deadline extension: Meridian Supply", "", "Re: your message", "DD-"])(
    "returns null for %s",
    (subject) => {
      expect(extractReference(subject)).toBeNull();
    },
  );
});

describe("stripQuotedText", () => {
  it("keeps a plain reply untouched", () => {
    expect(stripQuotedText("approved")).toBe("approved");
  });

  it("drops Gmail quoting", () => {
    const body = [
      "Approved, but only for Q3.",
      "",
      "On Wed, Aug 20, 2026 at 10:00 AM Dealdesk <dealdesk@example.com> wrote:",
      "> Dee Manager is asking to extend a supplier's deadline.",
      "> Supplier: Meridian Supply",
    ].join("\n");

    expect(stripQuotedText(body)).toBe("Approved, but only for Q3.");
  });

  it("drops Outlook quoting", () => {
    const body = [
      "No, 2 days is the most we can give.",
      "",
      "________________________________",
      "From: Dealdesk <dealdesk@example.com>",
      "Sent: 20 August 2026 10:00",
      "Subject: [DD-1042] Deadline extension",
    ].join("\r\n");

    expect(stripQuotedText(body)).toBe("No, 2 days is the most we can give.");
  });

  it("drops the older Outlook original-message divider", () => {
    const body = ["approved", "", "-----Original Message-----", "From: Dealdesk"].join("\n");
    expect(stripQuotedText(body)).toBe("approved");
  });

  it("drops Apple Mail quoting", () => {
    const body = [
      "Fine by me.",
      "",
      "On 20 Aug 2026, at 10:00, Dealdesk <dealdesk@example.com> wrote:",
      "",
      "Dee Manager is asking to extend a supplier's deadline.",
    ].join("\n");

    expect(stripQuotedText(body)).toBe("Fine by me.");
  });

  it("drops a signature block", () => {
    const body = ["approved", "", "--", "Dee Lead", "Sourcing Director"].join("\n");
    expect(stripQuotedText(body)).toBe("approved");
  });

  it("drops a phone signature and everything after it", () => {
    const body = ["approved", "", "Sent from my iPhone", "", "> quoted text"].join("\n");
    expect(stripQuotedText(body)).toBe("approved");
  });

  it("keeps only the reply when several markers appear", () => {
    const body = [
      "Approved.",
      "",
      "Sent from my iPhone",
      "",
      "On 20 Aug 2026, at 10:00, Dealdesk wrote:",
      "> the original",
    ].join("\n");

    expect(stripQuotedText(body)).toBe("Approved.");
  });

  it("returns empty when the reply is only quoted text", () => {
    expect(stripQuotedText("> just a quote\n> and more")).toBe("");
  });

  // A marker on the opening line used to strip the entire reply away.
  it("keeps the reply when it opens with something that looks like a header", () => {
    expect(stripQuotedText("From: my side, approved.")).toBe("From: my side, approved.");
  });

  it("keeps the reply when it opens with a phone signature phrase", () => {
    const body = "Sent from my iPhone, approved.\n\n> quoted";
    expect(stripQuotedText(body)).toBe("Sent from my iPhone, approved.");
  });

  it("does not mistake a number or a dash inside the reply for a marker", () => {
    expect(stripQuotedText("2 days - that is our limit")).toBe("2 days - that is our limit");
  });
});
