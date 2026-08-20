import { afterEach, describe, expect, it, vi } from "vitest";
import { parseRequest } from "@/ai/parseRequest";
import { clearFixtures, setFixture } from "@/ai/providers/fake";

vi.mock("@/config", () => ({
  getConfig: () => ({
    LLM_PROVIDER: "fake",
    MIN_PARSE_CONFIDENCE: 0.6,
    DEFAULT_CURRENCY: "USD",
  }),
}));

afterEach(() => {
  clearFixtures();
  vi.restoreAllMocks();
});

function fixture(message: string, extraction: Record<string, unknown>) {
  setFixture(message, JSON.stringify({ currency: null, reason: null, ...extraction }));
}

describe("parseRequest", () => {
  it("reads a complete request", async () => {
    fixture("m", {
      customer: "Acme",
      amount: 48000,
      discountPercent: 20,
      reason: "renewal at risk",
      confidence: 0.95,
    });

    const outcome = await parseRequest("m");

    expect(outcome).toEqual({
      kind: "parsed",
      model: "fake",
      extraction: {
        customer: "Acme",
        amount: 48000,
        currency: null,
        discountPercent: 20,
        reason: "renewal at risk",
        rationale: null,
        confidence: 0.95,
      },
    });
  });

  it.each([
    [
      "the discount",
      { customer: "Acme", amount: 48000, discountPercent: null },
      ["discountPercent"],
    ],
    ["the customer", { customer: null, amount: 48000, discountPercent: 20 }, ["customer"]],
    ["the amount", { customer: "Acme", amount: null, discountPercent: 20 }, ["amount"]],
    [
      "everything but the discount",
      { customer: null, amount: null, discountPercent: 20 },
      ["customer", "amount"],
    ],
  ])("reports %s as missing", async (_label, extraction, missing) => {
    fixture("m", { ...extraction, confidence: 0.9 });

    const outcome = await parseRequest("m");

    expect(outcome.kind).toBe("incomplete");
    expect(outcome.kind === "incomplete" && outcome.missing).toEqual(missing);
  });

  it("refuses to guess when the model is unsure", async () => {
    fixture("m", {
      customer: "Acme",
      amount: 48000,
      discountPercent: 20,
      confidence: 0.4,
    });

    const outcome = await parseRequest("m");

    expect(outcome).toEqual({
      kind: "unreadable",
      reason: "not recognised as a discount request",
    });
  });

  it.each([
    ["prose instead of JSON", "I think they want 20 percent"],
    ["a fenced code block", '```json\n{"customer":"Acme"}\n```'],
    ["truncated JSON", '{"customer":"Acme","amount":'],
    ["an empty answer", ""],
  ])("rejects %s", async (_label, response) => {
    setFixture("m", response);

    const outcome = await parseRequest("m");

    expect(outcome).toEqual({
      kind: "unreadable",
      reason: "model did not return valid JSON",
    });
  });

  it.each([
    ["a discount above 100", { customer: "A", amount: 1, discountPercent: 120, confidence: 0.9 }],
    ["a negative amount", { customer: "A", amount: -5, discountPercent: 20, confidence: 0.9 }],
    ["a confidence above 1", { customer: "A", amount: 1, discountPercent: 20, confidence: 4 }],
    ["a missing confidence", { customer: "A", amount: 1, discountPercent: 20 }],
    [
      "a customer that is a number",
      { customer: 42, amount: 1, discountPercent: 20, confidence: 1 },
    ],
  ])("refuses model output with %s", async (_label, extraction) => {
    fixture("m", extraction);

    expect((await parseRequest("m")).kind).toBe("unreadable");
  });

  it("carries the model's own note on how it read the message", async () => {
    setFixture(
      "m",
      JSON.stringify({
        customer: "Acme",
        amount: 48000,
        currency: null,
        discountPercent: 20,
        reason: null,
        rationale: "Discount and value are both stated plainly.",
        confidence: 0.95,
      }),
    );

    const outcome = await parseRequest("m");

    expect(outcome.kind === "parsed" && outcome.extraction.rationale).toBe(
      "Discount and value are both stated plainly.",
    );
  });

  it("refuses a note long enough to be an essay rather than a note", async () => {
    fixture("m", {
      customer: "Acme",
      amount: 48000,
      discountPercent: 20,
      rationale: "x".repeat(201),
      confidence: 0.95,
    });

    expect((await parseRequest("m")).kind).toBe("unreadable");
  });

  it("gives the model a second chance at valid JSON", async () => {
    const responses = [
      "not json at all",
      JSON.stringify({
        customer: "Acme",
        amount: 48000,
        currency: null,
        discountPercent: 20,
        reason: null,
        confidence: 0.9,
      }),
    ];
    let call = 0;
    const provider = await import("@/ai/providers/fake");
    vi.spyOn(provider.fakeProvider, "complete").mockImplementation(async () => {
      call += 1;
      return responses[call - 1];
    });

    const outcome = await parseRequest("m");

    expect(call).toBe(2);
    expect(outcome.kind).toBe("parsed");
  });

  it("never sends more than 2000 characters to the model", async () => {
    const provider = await import("@/ai/providers/fake");
    const spy = vi.spyOn(provider.fakeProvider, "complete").mockResolvedValue(
      JSON.stringify({
        customer: "Acme",
        amount: 1,
        currency: null,
        discountPercent: 5,
        reason: null,
        confidence: 0.9,
      }),
    );

    await parseRequest("x".repeat(50_000));

    expect(spy.mock.calls[0][0].user).toHaveLength(2_000);
  });

  it("gives up rather than hanging when the model does not answer", async () => {
    vi.useFakeTimers();
    const provider = await import("@/ai/providers/fake");
    vi.spyOn(provider.fakeProvider, "complete").mockImplementation(() => new Promise(() => {}));

    const pending = parseRequest("m");
    await vi.advanceTimersByTimeAsync(10_001);

    expect(await pending).toEqual({
      kind: "unreadable",
      reason: "model timed out",
    });
    vi.useRealTimers();
  });
});
