import { describe, expect, it } from "vitest";
import { isApprover, normaliseAddress } from "@/guards/approverAllowlist";

const APPROVERS = ["finance@example.com", "cfo@example.com"];

describe("normaliseAddress", () => {
  it.each([
    ["finance@example.com", "finance@example.com"],
    ["Dee Finance <finance@example.com>", "finance@example.com"],
    ["  FINANCE@Example.COM  ", "finance@example.com"],
    ['"Finance Dee" <Finance@Example.com>', "finance@example.com"],
  ])("reads %s as %s", (input, expected) => {
    expect(normaliseAddress(input)).toBe(expected);
  });
});

describe("isApprover", () => {
  it.each([
    "finance@example.com",
    "Dee Finance <finance@example.com>",
    "FINANCE@EXAMPLE.COM",
    "cfo@example.com",
  ])("accepts %s", (from) => {
    expect(isApprover(from, APPROVERS)).toBe(true);
  });

  it.each([
    "rep@example.com",
    "attacker@evil.com",
    "finance@example.com.evil.com",
    // The display name looks like an approver, the real address is not one.
    "finance@example.com <attacker@evil.com>",
    // Malformed headers are refused rather than salvaged.
    "evil.com<finance@example.com>x",
    "<finance@example.com> trailing",
    "finance@example.com, attacker@evil.com",
    "finance@example.com attacker@evil.com",
    "",
    "   ",
    "not-an-address",
  ])("refuses %s", (from) => {
    expect(isApprover(from, APPROVERS)).toBe(false);
  });

  it("approves nobody when no approver is configured", () => {
    expect(isApprover("finance@example.com", [])).toBe(false);
  });
});
