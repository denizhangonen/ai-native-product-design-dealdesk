export type SenderVerdict = "pass" | "fail" | "unknown";

/**
 * A From header is trivially forged, so the receiving mail server's own verdict
 * decides. SPF alone is not enough: a forwarded message legitimately fails it
 * while its DKIM signature still holds.
 */
export function checkSenderAuthentication(results: string | null): SenderVerdict {
  if (!results) return "unknown";
  const text = results.toLowerCase();
  const says = (mechanism: string, outcome: string) =>
    new RegExp(`\\b${mechanism}=${outcome}\\b`).test(text);

  if (says("dmarc", "fail")) return "fail";
  if (says("spf", "fail") && says("dkim", "fail")) return "fail";
  if (says("dmarc", "pass") || says("dkim", "pass") || says("spf", "pass")) return "pass";

  return "unknown";
}
