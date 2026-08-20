import { PARSE_DECISION_SYSTEM_PROMPT } from "@/ai/prompts/parseDecision";
import { getProvider } from "@/ai/provider";
import { type DecisionReading, decisionSchema } from "@/ai/schemas";
import { getConfig } from "@/config";

const TIMEOUT_MS = 10_000;
// A discount request or a decision is short. Anything longer is a quoted thread,
// a paste, or an attack, and sending it on would cost money for no benefit.
const MAX_INPUT_CHARS = 2_000;
const ATTEMPTS = 2;

export type DecisionOutcome =
  | {
      kind: "decided";
      reading: DecisionReading & { decision: "approve" | "reject" };
    }
  | { kind: "unclear"; reason: string };

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("model timed out")), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function readOutput(raw: string): DecisionReading | null {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = decisionSchema.safeParse(payload);
  return result.success ? result.data : null;
}

/**
 * Reads an approver's reply. Anything short of a plain approval or rejection
 * comes back unclear, so the state is never changed on a guess.
 */
export async function parseDecision(reply: string): Promise<DecisionOutcome> {
  const provider = getProvider();
  const minConfidence = getConfig().MIN_PARSE_CONFIDENCE;

  let reading: DecisionReading | null = null;

  for (let attempt = 0; attempt < ATTEMPTS && reading === null; attempt += 1) {
    let raw: string;
    try {
      raw = await withTimeout(
        provider.complete({
          task: "parse_decision",
          system: PARSE_DECISION_SYSTEM_PROMPT,
          user: reply.slice(0, MAX_INPUT_CHARS),
        }),
        TIMEOUT_MS,
      );
    } catch (error) {
      return { kind: "unclear", reason: (error as Error).message };
    }
    reading = readOutput(raw);
  }

  if (reading === null) return { kind: "unclear", reason: "model did not return valid JSON" };

  const { decision } = reading;
  if (decision === "unclear") return { kind: "unclear", reason: "reply was not a decision" };
  if (reading.confidence < minConfidence) {
    return { kind: "unclear", reason: "not confident enough to act" };
  }

  return { kind: "decided", reading: { ...reading, decision } };
}
