import { describe, expect, it } from "vitest";
import { decideRoute } from "@/domain/rules";

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
