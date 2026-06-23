// Twilio helpers — server-only. Never import from client components.

export function getTwilioCredentials() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

export interface TwilioSendResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

/** Send a single SMS via Twilio REST API (no SDK dependency). */
export async function twilioSend(
  to: string,
  body: string,
): Promise<TwilioSendResult> {
  const creds = getTwilioCredentials();
  if (!creds) {
    return { ok: false, error: "Twilio is not configured." };
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${creds.sid}:${creds.token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: creds.from, Body: body }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: (err as { message?: string }).message ?? `HTTP ${res.status}`,
    };
  }

  const json = (await res.json()) as { sid: string };
  return { ok: true, sid: json.sid };
}

/**
 * Validate a Twilio webhook signature.
 * Returns true if the request is genuinely from Twilio.
 */
export async function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): Promise<boolean> {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;

  // Twilio signs: url + sorted key/value pairs, HMAC-SHA1 with auth token.
  const sorted = Object.keys(params)
    .sort()
    .reduce((s, k) => s + k + params[k], url);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(sorted),
  );
  const computed = Buffer.from(mac).toString("base64");
  return computed === signature;
}
