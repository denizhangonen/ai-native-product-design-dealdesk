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
  customer: null,
  amount: null,
  currency: null,
  discountPercent: null,
  reason: null,
  rationale: null,
  confidence: 0,
};

const CURRENCY_SIGNS: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
};

function readDiscount(message: string): number | null {
  const match = message.match(/(\d+(?:\.\d+)?)\s*(?:%|percent\b|per cent\b)/i);
  return match ? Number(match[1]) : null;
}

function readAmount(message: string): number | null {
  const withoutDiscount = message.replace(/\d+(?:\.\d+)?\s*(?:%|percent\b|per cent\b)/gi, " ");

  const scaled = withoutDiscount.match(/(\d+(?:\.\d+)?)\s*([km])\b/i);
  if (scaled) {
    const factor = scaled[2].toLowerCase() === "m" ? 1_000_000 : 1_000;
    return Number(scaled[1]) * factor;
  }

  const plain = withoutDiscount.match(/[$€£]?\s*(\d[\d,]{2,})/);
  if (plain) {
    const value = Number(plain[1].replace(/,/g, ""));
    return Number.isFinite(value) && value >= 100 ? value : null;
  }
  return null;
}

function readCurrency(message: string): string | null {
  const code = message.match(/\b(usd|eur|gbp)\b/i);
  if (code) return code[1].toUpperCase();

  const sign = message.match(/[$€£]/);
  return sign ? CURRENCY_SIGNS[sign[0]] : null;
}

function readCustomer(message: string): string | null {
  const match = message.match(
    /\bfor\s+([A-Za-z0-9][A-Za-z0-9&.'-]*(?:\s+[A-Za-z0-9&.'-]+)*?)(?=\s*[,.]|\s+(?:on|at|the|deal|renewal|contract|account)\b|$)/i,
  );
  return match ? match[1].trim() : null;
}

function readReason(message: string): string | null {
  const match = message.match(
    /\b(?:because|since|as)\s+(.+)$|,\s*([^,]*\b(?:risk|churn|competit)[^,]*)$/i,
  );
  const reason = match?.[1] ?? match?.[2];
  return reason ? reason.trim().replace(/[.!]$/, "") : null;
}

function extract(message: string): Extraction {
  const discountPercent = readDiscount(message);
  const amount = readAmount(message);
  const customer = readCustomer(message);

  if (discountPercent === null && amount === null && customer === null) return EMPTY;

  const parts = { "a discount": discountPercent, "a deal value": amount, "a customer": customer };
  const read = Object.entries(parts)
    .filter(([, value]) => value !== null)
    .map(([label]) => label);

  return {
    customer,
    amount,
    currency: readCurrency(message),
    discountPercent,
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
  const counter = reply.match(/(\d+(?:\.\d+)?)\s*(?:%|percent\b)/i);
  const counterPercent = counter ? Number(counter[1]) : null;

  const approves = APPROVE.test(reply);
  const rejects = REJECT.test(reply) || (!approves && counterPercent !== null);

  // Saying both, or neither, is exactly the case that must not be guessed at.
  if (approves === rejects) {
    return { decision: "unclear", note: null, counterPercent, confidence: 0.9 };
  }

  const note = reply.match(/\b(?:but|only|provided|as long as)\b\s*(.+)$/i)?.[0]?.trim() ?? null;
  return {
    decision: approves ? "approve" : "reject",
    note: note && note.length > 0 ? note.replace(/[.!]$/, "") : null,
    counterPercent,
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
