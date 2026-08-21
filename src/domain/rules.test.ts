import { describe, expect, it } from "vitest";
import { decideFromCounter, decideRoute } from "@/domain/rules";

const THRESHOLD = 15;

describe("decideRoute", () => {
  it.each([0, 1, 14.99, 15])("keeps %s%% automatic, at or below the limit", (discountPercent) => {
    expect(decideRoute({ discountPercent }, THRESHOLD).route).toBe("auto");
  });

  it.each([15.01, 16, 100])("sends %s%% to finance, above the limit", (discountPercent) => {
    expect(decideRoute({ discountPercent }, THRESHOLD).route).toBe("finance");
  });

  it("treats the threshold itself as allowed", () => {
    expect(decideRoute({ discountPercent: 15.0 }, THRESHOLD).route).toBe("auto");
    expect(decideRoute({ discountPercent: 15.01 }, THRESHOLD).route).toBe("finance");
  });

  it("follows a threshold that is not the default", () => {
    expect(decideRoute({ discountPercent: 16 }, 20).route).toBe("auto");
    expect(decideRoute({ discountPercent: 21 }, 20).route).toBe("finance");
  });

  it("explains itself in the reason", () => {
    const decision = decideRoute({ discountPercent: 20 }, THRESHOLD);
    expect(decision.reason).toContain("20");
    expect(decision.reason).toContain("15");
  });
});

describe("decideFromCounter", () => {
  // A model reading English called this a rejection, and a rep was told no.
  it("treats a more generous counter as an approval", () => {
    expect(decideFromCounter({ decision: "reject", counterPercent: 50 }, 25)).toBe("approve");
  });

  it("treats a counter equal to the request as an approval", () => {
    expect(decideFromCounter({ decision: "reject", counterPercent: 25 }, 25)).toBe("approve");
  });

  it("keeps a smaller counter a rejection", () => {
    expect(decideFromCounter({ decision: "reject", counterPercent: 12 }, 20)).toBe("reject");
  });

  it("leaves a reply with no counter to the reading", () => {
    expect(decideFromCounter({ decision: "approve", counterPercent: null }, 20)).toBe("approve");
    expect(decideFromCounter({ decision: "reject", counterPercent: null }, 20)).toBe("reject");
  });

  it("never turns an approval into a rejection", () => {
    expect(decideFromCounter({ decision: "approve", counterPercent: 40 }, 20)).toBe("approve");
  });
});
