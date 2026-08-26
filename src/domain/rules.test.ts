import { describe, expect, it } from "vitest";
import { decideFromCounter, decideRoute, isPlausibleCounter } from "@/domain/rules";

const MAX_AUTO_DAYS = 3;

describe("decideRoute", () => {
  it.each([1, 2, 3])("keeps %s days automatic, at or below the limit", (extensionDays) => {
    expect(decideRoute({ extensionDays }, MAX_AUTO_DAYS).route).toBe("auto");
  });

  it.each([4, 7, 30])("sends %s days to the sourcing lead, above the limit", (extensionDays) => {
    expect(decideRoute({ extensionDays }, MAX_AUTO_DAYS).route).toBe("lead");
  });

  it("treats the limit itself as allowed", () => {
    expect(decideRoute({ extensionDays: 3 }, MAX_AUTO_DAYS).route).toBe("auto");
    expect(decideRoute({ extensionDays: 4 }, MAX_AUTO_DAYS).route).toBe("lead");
  });

  it("follows a limit that is not the default", () => {
    expect(decideRoute({ extensionDays: 5 }, 5).route).toBe("auto");
    expect(decideRoute({ extensionDays: 6 }, 5).route).toBe("lead");
  });

  it("explains itself in the reason", () => {
    const decision = decideRoute({ extensionDays: 7 }, MAX_AUTO_DAYS);
    expect(decision.reason).toContain("7 days");
    expect(decision.reason).toContain("3-day limit");
  });

  it("speaks of one day in the singular", () => {
    expect(decideRoute({ extensionDays: 1 }, MAX_AUTO_DAYS).reason).toContain("1 day is");
  });
});

describe("decideFromCounter", () => {
  // A model reading English called this a rejection, and a manager was told no.
  it("treats a more generous counter as an approval", () => {
    expect(decideFromCounter({ decision: "reject", counterDays: 10 }, 5)).toBe("approve");
  });

  it("treats a counter equal to the request as an approval", () => {
    expect(decideFromCounter({ decision: "reject", counterDays: 5 }, 5)).toBe("approve");
  });

  it("keeps a shorter counter a rejection", () => {
    expect(decideFromCounter({ decision: "reject", counterDays: 2 }, 7)).toBe("reject");
  });

  it("leaves a reply with no counter to the reading", () => {
    expect(decideFromCounter({ decision: "approve", counterDays: null }, 5)).toBe("approve");
    expect(decideFromCounter({ decision: "reject", counterDays: null }, 5)).toBe("reject");
  });

  it("never turns an approval into a rejection", () => {
    expect(decideFromCounter({ decision: "approve", counterDays: 10 }, 5)).toBe("approve");
  });
});

describe("isPlausibleCounter", () => {
  it("accepts a counter at or below the request", () => {
    expect(isPlausibleCounter(5, 5)).toBe(true);
    expect(isPlausibleCounter(1, 14)).toBe(true);
    expect(isPlausibleCounter(0, 5)).toBe(true);
  });

  it("accepts up to twice the request plus a little room", () => {
    expect(isPlausibleCounter(13, 5)).toBe(true);
    expect(isPlausibleCounter(14, 5)).toBe(false);
  });

  it("gives a small request room for a slightly larger answer", () => {
    expect(isPlausibleCounter(3, 1)).toBe(true);
    expect(isPlausibleCounter(5, 1)).toBe(true);
    expect(isPlausibleCounter(6, 1)).toBe(false);
  });

  it("refuses more than sixty days whatever was asked", () => {
    expect(isPlausibleCounter(60, 40)).toBe(true);
    expect(isPlausibleCounter(61, 40)).toBe(false);
    expect(isPlausibleCounter(300, 200)).toBe(false);
  });
});
