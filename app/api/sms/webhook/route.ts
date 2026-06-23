import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateTwilioSignature } from "@/lib/twilio";

export const runtime = "nodejs";

// Twilio webhook — receives inbound SMS and delivery status callbacks.
// Uses the service-role key (bypasses RLS) because there's no authenticated
// user on this request. Validates the Twilio signature before touching the DB.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SC = SupabaseClient<any>;

function getServiceClient(): SC | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient(url, key) as SC;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  // Validate Twilio signature.
  const url = request.url;
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const valid = await validateTwilioSignature(url, params, signature);
  if (!valid) {
    return new Response("Forbidden", { status: 403 });
  }

  const supabase = getServiceClient();
  if (!supabase) return new Response("Not configured", { status: 503 });

  // Delivery status callback (MessageSid present, From is our number).
  if (params.MessageStatus && params.MessageSid) {
    const statusMap: Record<string, string> = {
      delivered: "delivered",
      failed: "failed",
      undelivered: "failed",
      sent: "sent",
    };
    const mapped = statusMap[params.MessageStatus];
    if (mapped) {
      await supabase
        .from("messages")
        .update({ status: mapped })
        .eq("twilio_sid", params.MessageSid);
    }
    return new Response("", { status: 204 });
  }

  // Inbound message (From is the client's phone).
  const from = params.From; // E.164
  const body = params.Body ?? "";

  if (!from) return new Response("", { status: 204 });

  // Handle STOP — set sms_consent = false on matching client.
  const stopWords = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
  if (stopWords.includes(body.trim().toUpperCase())) {
    await supabase
      .from("clients")
      .update({ sms_consent: false })
      .eq("phone", from);
    // Twilio expects an empty TwiML response for STOP handling.
    return new Response("<Response/>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Store the inbound message — find the client by phone.
  const { data: client } = await supabase
    .from("clients")
    .select("id, owner_id")
    .eq("phone", from)
    .maybeSingle();

  if (client) {
    await supabase.from("messages").insert({
      owner_id: client.owner_id,
      client_id: client.id,
      direction: "inbound",
      channel: "sms",
      body,
      status: "delivered",
    });
  }

  return new Response("<Response/>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
