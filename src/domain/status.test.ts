import { describe, expect, it } from "vitest";
import { InvalidTransition } from "@/domain/errors";
import {
  REQUEST_EVENTS,
  REQUEST_STATUSES,
  type RequestEvent,
  type RequestStatus,
  isFinal,
  transition,
} from "@/domain/status";

const ALLOWED: Array<[RequestStatus, RequestEvent, RequestStatus]> = [
  ["pending_review", "submitted", "pending_lead"],
  ["pending_review", "auto_approved", "approved"],
  ["pending_lead", "lead_approved", "approved"],
  ["pending_lead", "lead_rejected", "rejected"],
];

describe("transition", () => {
  it.each(ALLOWED)("moves %s through %s to %s", (from, event, expected) => {
    expect(transition(from, event)).toBe(expected);
  });

  const allowedKeys = new Set(ALLOWED.map(([from, event]) => `${from}:${event}`));
  const forbidden = REQUEST_STATUSES.flatMap((from) =>
    REQUEST_EVENTS.filter((event) => !allowedKeys.has(`${from}:${event}`)).map(
      (event) => [from, event] as const,
    ),
  );

  it.each(forbidden)("refuses %s through %s", (from, event) => {
    expect(() => transition(from, event)).toThrow(InvalidTransition);
  });

  it("covers every status and event combination", () => {
    expect(ALLOWED.length + forbidden.length).toBe(REQUEST_STATUSES.length * REQUEST_EVENTS.length);
  });

  it("never leaves a final status", () => {
    for (const status of REQUEST_STATUSES.filter(isFinal)) {
      for (const event of REQUEST_EVENTS) {
        expect(() => transition(status, event)).toThrow(InvalidTransition);
      }
    }
  });
});
