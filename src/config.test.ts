import { describe, expect, it } from "vitest";
import { configSchema } from "@/config";

describe("configSchema", () => {
  it("defaults the approval threshold to 15", () => {
    const config = configSchema.parse({
      DATABASE_URL: "postgresql://localhost/x",
    });
    expect(config.APPROVAL_THRESHOLD_PERCENT).toBe(15);
    expect(config.LLM_PROVIDER).toBe("fake");
  });

  it("reads the threshold from the environment", () => {
    const config = configSchema.parse({
      DATABASE_URL: "postgresql://localhost/x",
      APPROVAL_THRESHOLD_PERCENT: "20",
    });
    expect(config.APPROVAL_THRESHOLD_PERCENT).toBe(20);
  });

  it("rejects a missing database url", () => {
    expect(configSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a threshold outside 0-100", () => {
    const result = configSchema.safeParse({
      DATABASE_URL: "postgresql://localhost/x",
      APPROVAL_THRESHOLD_PERCENT: "150",
    });
    expect(result.success).toBe(false);
  });
});
