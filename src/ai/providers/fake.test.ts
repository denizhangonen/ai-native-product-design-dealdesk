import { afterEach, describe, expect, it } from "vitest";
import { PARSE_REQUEST_SYSTEM_PROMPT } from "@/ai/prompts/parseRequest";
import { clearFixtures, fakeProvider, setFixture } from "@/ai/providers/fake";
import { extractionSchema } from "@/ai/schemas";

afterEach(clearFixtures);

async function read(message: string) {
  const raw = await fakeProvider.complete({
    task: "parse_request",
    system: PARSE_REQUEST_SYSTEM_PROMPT,
    user: message,
  });
  return extractionSchema.parse(JSON.parse(raw));
}

const FIXED =
  '{"supplier":"Fixed","event":"RFP-1","extensionDays":2,"reason":null,"confidence":1}';

describe("fakeProvider", () => {
  it("prefers a fixture over its own guessing", async () => {
    setFixture("anything", FIXED);
    expect((await read("anything")).supplier).toBe("Fixed");
  });

  it("matches a fixture regardless of spacing and case", async () => {
    setFixture("Need 2 more days", FIXED);
    expect((await read("  need   2 MORE days  ")).supplier).toBe("Fixed");
  });

  it.each([
    [
      "Meridian Supply asked for 2 more days on RFP-2041, their plant lost power",
      { supplier: "Meridian Supply", event: "RFP-2041", extensionDays: 2 },
    ],
    [
      "Can we give Nordvik Components a week on RFQ-318? their lead engineer is off sick",
      { supplier: "Nordvik Components", event: "RFQ-318", extensionDays: 7 },
    ],
    [
      "Atlas Freight needs 5 extra days on rfp-2044, customs delay",
      { supplier: "Atlas Freight", event: "RFP-2044", extensionDays: 5 },
    ],
    [
      "48 hours more for Cobalt Metals on RFQ-77 please",
      { supplier: "Cobalt Metals", event: "RFQ-77", extensionDays: 2 },
    ],
  ])("reads %s", async (message, expected) => {
    const extraction = await read(message);
    expect(extraction.supplier).toBe(expected.supplier);
    expect(extraction.event).toBe(expected.event);
    expect(extraction.extensionDays).toBe(expected.extensionDays);
    expect(extraction.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("does not mistake the event number for the number of days", async () => {
    expect((await read("Meridian Supply asked for 2 more days on RFP-2041")).extensionDays).toBe(2);
  });

  it("picks up the reason when one is given", async () => {
    const extraction = await read("Meridian Supply asked for 2 more days on RFP-2041 because their plant lost power");
    expect(extraction.reason).toBe("their plant lost power");
  });

  it("is not confident about a message that is not an extension request", async () => {
    const extraction = await read("who is on call this weekend?");
    expect(extraction.confidence).toBeLessThan(0.6);
    expect(extraction.extensionDays).toBeNull();
  });

  it("is not confident when the number of days is missing", async () => {
    const extraction = await read("Meridian Supply asked for more time on RFP-2041");
    expect(extraction.extensionDays).toBeNull();
    expect(extraction.confidence).toBeLessThan(0.6);
  });

  it("always returns output that satisfies the schema", async () => {
    const messages = ["", "???", "2 days", "for Meridian Supply", "RFP-1 a week because customs"];
    for (const message of messages) {
      await expect(read(message)).resolves.toBeDefined();
    }
  });
});
