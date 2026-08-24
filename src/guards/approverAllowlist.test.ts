import { describe, expect, it } from "vitest";
import { isApprover, normaliseAddress } from "@/guards/approverAllowlist";

const APPROVERS = ["lead@example.com", "cpo@example.com"];

describe("normaliseAddress", () => {
  it.each([
    ["lead@example.com", "lead@example.com"],
    ["Dee Lead <lead@example.com>", "lead@example.com"],
    ["  LEAD@Example.COM  ", "lead@example.com"],
    ['"Lead Dee" <Lead@Example.com>', "lead@example.com"],
  ])("reads %s as %s", (input, expected) => {
    expect(normaliseAddress(input)).toBe(expected);
  });
});

describe("isApprover", () => {
  it.each([
    "lead@example.com",
    "Dee Lead <lead@example.com>",
    "LEAD@EXAMPLE.COM",
    "cpo@example.com",
  ])("accepts %s", (from) => {
    expect(isApprover(from, APPROVERS)).toBe(true);
  });

  it.each([
    "rep@example.com",
    "attacker@evil.com",
    "lead@example.com.evil.com",
    // The display name looks like an approver, the real address is not one.
    "lead@example.com <attacker@evil.com>",
    // Malformed headers are refused rather than salvaged.
    "evil.com<lead@example.com>x",
    "<lead@example.com> trailing",
    "lead@example.com, attacker@evil.com",
    "lead@example.com attacker@evil.com",
    "",
    "   ",
    "not-an-address",
  ])("refuses %s", (from) => {
    expect(isApprover(from, APPROVERS)).toBe(false);
  });

  it("approves nobody when no approver is configured", () => {
    expect(isApprover("lead@example.com", [])).toBe(false);
  });
});
