import type { QuoteStatus } from "./types";

// Canonical legal transitions — mirrors set_quote_status() / the DB trigger.
// The DATABASE is the source of truth; this exists so the UI can show/hide
// actions without round-tripping. Never use this to "enforce" — always go
// through the server-side function (lib/quotes.ts → set_quote_status RPC).
const LEGAL: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: [],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return LEGAL[from]?.includes(to) ?? false;
}

export function nextStatuses(from: QuoteStatus): QuoteStatus[] {
  return LEGAL[from] ?? [];
}
