// Deliberately strict: one @, no spaces, no brackets. Anything else is not an address.
const ADDRESS = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;

// `Display Name <addr@example.com>`, with nothing trailing the closing bracket.
const ANGLED = /^[^<>]*<([^<>]*)>$/;

/**
 * Reduces a From header to a bare address, or to an empty string when the header
 * is malformed. Returning empty rather than a best guess means a header crafted to
 * look like an approver cannot be salvaged into one.
 */
export function normaliseAddress(from: string): string {
  const trimmed = from.trim();
  const angled = trimmed.match(ANGLED);
  const candidate = (angled ? angled[1] : trimmed).trim().toLowerCase();

  return ADDRESS.test(candidate) ? candidate : "";
}

/**
 * Only a configured approver may decide. An empty allow-list approves nobody,
 * so a missing configuration fails closed rather than open.
 */
export function isApprover(from: string, approvers: string[]): boolean {
  const address = normaliseAddress(from);
  if (!address) return false;

  return approvers.some((approver) => approver.trim().toLowerCase() === address);
}
