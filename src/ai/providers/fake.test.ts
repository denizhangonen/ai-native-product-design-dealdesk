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

describe("fakeProvider", () => {
  it("prefers a fixture over its own guessing", async () => {
    setFixture(
      "anything",
      '{"customer":"Fixed","amount":1,"currency":null,"discountPercent":5,"reason":null,"confidence":1}',
    );
    expect((await read("anything")).customer).toBe("Fixed");
  });

  it("matches a fixture regardless of spacing and case", async () => {
    setFixture(
      "Need 20% off",
      '{"customer":"Cased","amount":1,"currency":null,"discountPercent":5,"reason":null,"confidence":1}',
    );
    expect((await read("  need   20% OFF  ")).customer).toBe("Cased");
  });

  it.each([
    ["Need 20% off for Acme, 48k deal", { customer: "Acme", amount: 48000, discountPercent: 20 }],
    [
      "can we do 10 percent for Globex on the 12k renewal",
      { customer: "Globex", amount: 12000, discountPercent: 10 },
    ],
    [
      "15% for Initech, $250,000 contract",
      { customer: "Initech", amount: 250000, discountPercent: 15 },
    ],
    [
      "1.2m deal for Umbrella, 25% off",
      { customer: "Umbrella", amount: 1200000, discountPercent: 25 },
    ],
  ])("reads %s", async (message, expected) => {
    const extraction = await read(message);
    expect(extraction.customer).toBe(expected.customer);
    expect(extraction.amount).toBe(expected.amount);
    expect(extraction.discountPercent).toBe(expected.discountPercent);
    expect(extraction.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("does not mistake the discount for the deal value", async () => {
    expect((await read("20% off for Acme, 48k deal")).amount).toBe(48000);
  });

  it.each([
    ["$", "USD"],
    ["€", "EUR"],
    ["£", "GBP"],
  ])("reads the %s sign as %s", async (sign, code) => {
    expect((await read(`20% off for Acme, ${sign}48,000 deal`)).currency).toBe(code);
  });

  it("leaves the currency null when the message does not say", async () => {
    expect((await read("20% off for Acme, 48k deal")).currency).toBeNull();
  });

  it("is not confident about a message that is not a discount request", async () => {
    const extraction = await read("who is on call this weekend?");
    expect(extraction.confidence).toBeLessThan(0.6);
    expect(extraction.discountPercent).toBeNull();
  });

  it("is not confident when the discount is missing", async () => {
    const extraction = await read("can we help Acme on the 48k renewal");
    expect(extraction.discountPercent).toBeNull();
    expect(extraction.confidence).toBeLessThan(0.6);
  });

  it("always returns output that satisfies the schema", async () => {
    const messages = [
      "",
      "???",
      "20%",
      "for Acme",
      "1.2m for Umbrella, 25% off because churn risk",
    ];
    for (const message of messages) {
      await expect(read(message)).resolves.toBeDefined();
    }
  });
});
