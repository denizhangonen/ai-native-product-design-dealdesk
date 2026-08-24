import type { CompletionRequest, LlmProvider } from "@/ai/provider";
import type { DecisionReading, Extraction } from "@/ai/schemas";

/**
 * A stand-in for a model, so the whole flow can be exercised with no key and no
 * network. It is deliberately crude pattern matching, not a parser worth keeping:
 * a real provider replaces it behind the same interface.
 *
 * Fixtures are matched first, so a test can pin any answer it likes, including
 * malformed output.
 */
const fixtures = new Map<string, string>();

export function setFixture(message: string, response: string): void {
  fixtures.set(normalise(message), response);
}

export function clearFixtures(): void {
  fixtures.clear();
}

function normalise(message: string): string {
  return message.trim().toLowerCase().replace(/\s+/g, " ");
}

const EMPTY: Extraction = {
  supplier: null,
  event: null,
  extensionDays: null,
  reason: null,
  rationale: null,
  confidence: 0,
};

// Whole words only: "extra days" must not read as "a day".
const WORD_DAYS: Array<[RegExp, number]> = [
  [/\b(?:a|one) day\b/, 1],
  [/\btwo days\b/, 2],
  [/\bthree days\b/, 3],
  [/\b(?:a|one) week\b/, 7],
  [/\btwo weeks\b/, 14],
];

function readDays(message: string): number | null {
  const lower = message.toLowerCase();
  for (const [phrase, days] of WORD_DAYS) {
    if (phrase.test(lower)) return days;
  }
  const hours = lower.match(/(\d+)\s*(?:hours|hrs)\b/);
  if (hours) return Math.max(1, Math.round(Number(hours[1]) / 24));

  const days = lower.match(/(\d+)\s*(?:more|extra|additional)?\s*(?:business\s+|working\s+)?days?\b/);
  return days ? Number(days[1]) : null;
}

function readEvent(message: string): string | null {
  const match = message.match(/\b(RF[PQIX]-\d+)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function readSupplier(message: string): string | null {
  // "<Supplier> asked for ..." or "give <Supplier> ..." or "for <Supplier> on ..."
  const patterns = [
    /^([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*)*)\s+(?:asked|asks|wants|needs|is asking|are asking)\b/,
    /\b(?:give|grant|for)\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*)*)(?=\s+(?:a|an|\d|on|another|more)\b|\s*[,.?]|$)/,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function readReason(message: string): string | null {
  const match = message.match(/\b(?:because|since|as)\s+(.+)$|[,?]\s*([^,?]*\b(?:sick|flood|power|delay|late|holiday|strike|customs|waiting)[^,?]*)$/i);
  const reason = match?.[1] ?? match?.[2];
  return reason ? reason.trim().replace(/[.!]$/, "") : null;
}

function extract(message: string): Extraction {
  const extensionDays = readDays(message);
  const event = readEvent(message);
  const supplier = readSupplier(message);

  if (extensionDays === null && event === null && supplier === null) return EMPTY;

  const parts = { "a supplier": supplier, "an event": event, "a number of days": extensionDays };
  const read = Object.entries(parts)
    .filter(([, value]) => value !== null)
    .map(([label]) => label);

  return {
    supplier,
    event,
    extensionDays,
    reason: readReason(message),
    rationale: `Matched ${read.join(", ")} in the message by pattern, without a model.`,
    // Three of three reads as a confident extraction; fewer deliberately is not.
    confidence: read.length === 3 ? 0.95 : read.length === 2 ? 0.55 : 0.3,
  };
}

const APPROVE = /\b(approve[ds]?|approval|agreed|go ahead|fine by me|ok(ay)?|yes|sign(ed)? off)\b/i;
const REJECT =
  /\b(reject(ed)?|declin(e|ed)|denied?|no can do|not approved|too (much|steep)|^no\b)\b/i;

function readDecision(reply: string): DecisionReading {
  const counter = reply.match(/(\d+)\s*days?\b/i);
  const counterDays = counter ? Number(counter[1]) : null;

  const approves = APPROVE.test(reply);
  const rejects = REJECT.test(reply) || (!approves && counterDays !== null);

  // Saying both, or neither, is exactly the case that must not be guessed at.
  if (approves === rejects) {
    return { decision: "unclear", note: null, counterDays, confidence: 0.9 };
  }

  const note = reply.match(/\b(?:but|only|provided|as long as)\b\s*(.+)$/i)?.[0]?.trim() ?? null;
  return {
    decision: approves ? "approve" : "reject",
    note: note && note.length > 0 ? note.replace(/[.!]$/, "") : null,
    counterDays,
    confidence: 0.95,
  };
}

export const fakeProvider: LlmProvider = {
  name: "fake",
  async complete(request: CompletionRequest): Promise<string> {
    const fixture = fixtures.get(normalise(request.user));
    if (fixture !== undefined) return fixture;

    const answer =
      request.task === "parse_decision" ? readDecision(request.user) : extract(request.user);
    return JSON.stringify(answer);
  },
};
