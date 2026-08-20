import { describe, expect, it } from "vitest";
import { checkSenderAuthentication } from "@/guards/senderAuthentication";

// Taken from a real delivery, trimmed.
const GENUINE =
  "amazonses.com; spf=pass (spfCheck: domain of send.dealdesk.colloai.com designates " +
  "54.240.3.14 as permitted sender) client-ip=54.240.3.14; dkim=pass header.i=@colloai.com; " +
  "dmarc=pass header.from=colloai.com";

describe("checkSenderAuthentication", () => {
  it("accepts a genuine delivery", () => {
    expect(checkSenderAuthentication(GENUINE)).toBe("pass");
  });

  it("refuses a message whose sending domain disowns it", () => {
    expect(checkSenderAuthentication("amazonses.com; spf=fail; dkim=fail; dmarc=fail")).toBe("fail");
  });

  it("refuses on a DMARC failure even when SPF passed", () => {
    expect(checkSenderAuthentication("amazonses.com; spf=pass; dmarc=fail")).toBe("fail");
  });

  it("accepts a forwarded message, where SPF breaks but the signature holds", () => {
    expect(checkSenderAuthentication("amazonses.com; spf=fail; dkim=pass")).toBe("pass");
  });

  it("reports an absent verdict as unknown rather than guessing either way", () => {
    expect(checkSenderAuthentication(null)).toBe("unknown");
    expect(checkSenderAuthentication("amazonses.com; something-else=yes")).toBe("unknown");
  });

  it("is not fooled by a verdict word appearing inside another value", () => {
    expect(checkSenderAuthentication("amazonses.com; spf=passing-by")).toBe("unknown");
    expect(checkSenderAuthentication("header.from=dkim=fail.example.com")).toBe("unknown");
  });

  it("reads the verdict whatever its casing", () => {
    expect(checkSenderAuthentication("amazonses.com; DMARC=PASS")).toBe("pass");
  });
});
