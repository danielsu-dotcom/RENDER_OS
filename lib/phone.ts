import { parsePhoneNumberFromString } from "libphonenumber-js";

// All phone input is normalized to E.164 (+1...) at write time. Default region
// is CA since this is a BC field-service business.

export interface PhoneResult {
  ok: boolean;
  e164?: string;
  error?: string;
}

export function normalizePhone(input: string, region: "CA" = "CA"): PhoneResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: "Phone number is required." };

  const parsed = parsePhoneNumberFromString(raw, region);
  if (!parsed || !parsed.isValid()) {
    return { ok: false, error: "Enter a valid phone number." };
  }
  return { ok: true, e164: parsed.number }; // .number is E.164
}

/** Throwing variant for server code that has already validated upstream. */
export function toE164OrThrow(input: string): string {
  const r = normalizePhone(input);
  if (!r.ok || !r.e164) throw new Error(r.error ?? "Invalid phone number.");
  return r.e164;
}

/** Pretty national format for display (falls back to the raw E.164). */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatNational() : e164;
}
