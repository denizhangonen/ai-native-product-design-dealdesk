import { describe, expect, it } from "vitest";
import { configSchema } from "@/config";

describe("configSchema", () => {
  it("defaults the automatic approval limit to 3 days", () => {
    const config = configSchema.parse({
      DATABASE_URL: "postgresql://localhost/x",
    });
    expect(config.AUTO_APPROVE_MAX_DAYS).toBe(3);
    expect(config.LLM_PROVIDER).toBe("fake");
  });

  it("reads the limit from the environment", () => {
    const config = configSchema.parse({
      DATABASE_URL: "postgresql://localhost/x",
      AUTO_APPROVE_MAX_DAYS: "5",
    });
    expect(config.AUTO_APPROVE_MAX_DAYS).toBe(5);
  });

  it("rejects a missing database url", () => {
    expect(configSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a limit that is not a whole number of days within a year", () => {
    for (const value of ["-1", "1.5", "400"]) {
      const result = configSchema.safeParse({
        DATABASE_URL: "postgresql://localhost/x",
        AUTO_APPROVE_MAX_DAYS: value,
      });
      expect(result.success).toBe(false);
    }
  });
});
