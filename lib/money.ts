// Money is always integer CENTS in the domain. These helpers are the only
// place cents↔display conversion happens.

export const GST_RATE = 0.05; // BC/Canada GST 5%

/** GST on a subtotal (cents) → cents, rounded to the nearest cent. */
export function gstOf(subtotalCents: number): number {
  return Math.round(subtotalCents * GST_RATE);
}

export interface QuoteTotals {
  subtotal: number;
  gst: number;
  total: number;
}

/** Sum line items (price × qty, all cents) and apply GST. */
export function totalsFromLineItems(
  items: { price: number; qty: number }[],
): QuoteTotals {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const gst = gstOf(subtotal);
  return { subtotal, gst, total: subtotal + gst };
}

/** Cents → "$1,234.50" (CAD). */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

/** Parse a dollar string/number (e.g. "12.50") → integer cents. */
export function dollarsToCents(input: string | number): number {
  const n = typeof input === "number" ? input : parseFloat(input);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
