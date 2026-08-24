import { afterEach, describe, expect, it, vi } from "vitest";
import { parseRequest } from "@/ai/parseRequest";
import { clearFixtures, setFixture } from "@/ai/providers/fake";

vi.mock("@/config", () => ({
  getConfig: () => ({
    LLM_PROVIDER: "fake",
    MIN_PARSE_CONFIDENCE: 0.6,
  }),
}));

afterEach(() => {
  clearFixtures();
  vi.restoreAllMocks();
});

function fixture(message: string, extraction: Record<string, unknown>) {
  setFixture(message, JSON.stringify({ reason: null, ...extraction }));
}

describe("parseRequest", () => {
  it("reads a complete request", async () => {
    fixture("m", {
      supplier: "Meridian Supply",
      event: "RFP-2041",
      extensionDays: 5,
      reason: "their plant lost power",
      confidence: 0.95,
    });

    const outcome = await parseRequest("m");

    expect(outcome).toEqual({
      kind: "parsed",
      model: "fake",
      extraction: {
        supplier: "Meridian Supply",
        event: "RFP-2041",
        extensionDays: 5,
        reason: "their plant lost power",
        rationale: null,
        confidence: 0.95,
      },
    });
  });

  it.each([
    ["the days", { supplier: "Meridian", event: "RFP-1", extensionDays: null }, ["extensionDays"]],
    ["the supplier", { supplier: null, event: "RFP-1", extensionDays: 5 }, ["supplier"]],
    ["the event", { supplier: "Meridian", event: null, extensionDays: 5 }, ["event"]],
    [
      "everything but the days",
      { supplier: null, event: null, extensionDays: 5 },
      ["supplier", "event"],
    ],
  ])("reports %s as missing", async (_label, extraction, missing) => {
    fixture("m", { ...extraction, confidence: 0.9 });

    const outcome = await parseRequest("m");

    expect(outcome.kind).toBe("incomplete");
    expect(outcome.kind === "incomplete" && outcome.missing).toEqual(missing);
  });

  it("refuses to guess when the model is unsure", async () => {
    fixture("m", { supplier: "Meridian", event: "RFP-1", extensionDays: 5, confidence: 0.4 });

    const outcome = await parseRequest("m");

    expect(outcome).toEqual({
      kind: "unreadable",
      reason: "not recognised as an extension request",
    });
  });

  it.each([
    ["prose instead of JSON", "I think they want a week"],
    ["a fenced code block", '```json\n{"supplier":"Meridian"}\n```'],
    ["truncated JSON", '{"supplier":"Meridian","event":'],
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
    ["more than a year of days", { supplier: "A", event: "E", extensionDays: 400, confidence: 0.9 }],
    ["zero days", { supplier: "A", event: "E", extensionDays: 0, confidence: 0.9 }],
    ["a fraction of a day", { supplier: "A", event: "E", extensionDays: 1.5, confidence: 0.9 }],
    ["a confidence above 1", { supplier: "A", event: "E", extensionDays: 2, confidence: 4 }],
    ["a missing confidence", { supplier: "A", event: "E", extensionDays: 2 }],
    ["a supplier that is a number", { supplier: 42, event: "E", extensionDays: 2, confidence: 1 }],
  ])("refuses model output with %s", async (_label, extraction) => {
    fixture("m", extraction);

    expect((await parseRequest("m")).kind).toBe("unreadable");
  });

  it("carries the model's own note on how it read the message", async () => {
    setFixture(
      "m",
      JSON.stringify({
        supplier: "Meridian Supply",
        event: "RFP-2041",
        extensionDays: 5,
        reason: null,
        rationale: "Supplier, event and days are all stated plainly.",
        confidence: 0.95,
      }),
    );

    const outcome = await parseRequest("m");

    expect(outcome.kind === "parsed" && outcome.extraction.rationale).toBe(
      "Supplier, event and days are all stated plainly.",
    );
  });

  it("refuses a note long enough to be an essay rather than a note", async () => {
    fixture("m", {
      supplier: "Meridian Supply",
      event: "RFP-2041",
      extensionDays: 5,
      rationale: "x".repeat(201),
      confidence: 0.95,
    });

    expect((await parseRequest("m")).kind).toBe("unreadable");
  });

  it("gives the model a second chance at valid JSON", async () => {
    const responses = [
      "not json at all",
      JSON.stringify({
        supplier: "Meridian Supply",
        event: "RFP-2041",
        extensionDays: 5,
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
        supplier: "Meridian Supply",
        event: "RFP-2041",
        extensionDays: 2,
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
