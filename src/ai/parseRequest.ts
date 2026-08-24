import { PARSE_REQUEST_SYSTEM_PROMPT } from "@/ai/prompts/parseRequest";
import { getProvider } from "@/ai/provider";
import {
  type CompleteExtraction,
  type Extraction,
  type RequiredField,
  extractionSchema,
  missingFields,
} from "@/ai/schemas";
import { getConfig } from "@/config";

const TIMEOUT_MS = 10_000;
// An extension request or a decision is short. Anything longer is a quoted thread,
// a paste, or an attack, and sending it on would cost money for no benefit.
const MAX_INPUT_CHARS = 2_000;
const ATTEMPTS = 2;

export type ParseOutcome =
  | { kind: "parsed"; extraction: CompleteExtraction; model: string }
  | { kind: "incomplete"; extraction: Extraction; missing: RequiredField[] }
  | { kind: "unreadable"; reason: string };

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("model timed out")), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function readOutput(raw: string): Extraction | null {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = extractionSchema.safeParse(payload);
  return result.success ? result.data : null;
}

/**
 * Turns a Slack message into structured fields. The result is validated before
 * it leaves this function, so nothing downstream ever sees raw model output.
 */
export async function parseRequest(message: string): Promise<ParseOutcome> {
  const provider = getProvider();
  const minConfidence = getConfig().MIN_PARSE_CONFIDENCE;

  let extraction: Extraction | null = null;

  // One retry, because a model returning almost-JSON once is common and cheap to redo.
  for (let attempt = 0; attempt < ATTEMPTS && extraction === null; attempt += 1) {
    let raw: string;
    try {
      raw = await withTimeout(
        provider.complete({
          task: "parse_request",
          system: PARSE_REQUEST_SYSTEM_PROMPT,
          user: message.slice(0, MAX_INPUT_CHARS),
        }),
        TIMEOUT_MS,
      );
    } catch (error) {
      return { kind: "unreadable", reason: (error as Error).message };
    }
    extraction = readOutput(raw);
  }

  if (extraction === null) return { kind: "unreadable", reason: "model did not return valid JSON" };
  if (extraction.confidence < minConfidence) {
    return {
      kind: "unreadable",
      reason: "not recognised as an extension request",
    };
  }

  const missing = missingFields(extraction);
  if (missing.length > 0) return { kind: "incomplete", extraction, missing };

  // Narrowed once here, where the check just proved it, so callers need no casts.
  return { kind: "parsed", extraction: extraction as CompleteExtraction, model: provider.name };
}
