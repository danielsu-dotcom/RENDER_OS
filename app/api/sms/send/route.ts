import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { twilioSend } from "@/lib/twilio";
import type { Locale } from "@/lib/types";

export const runtime = "nodejs";

interface SendBody {
  client_id: string;
  to: string;
  body: string;
  template_key?: string;
  language?: Locale;
}

// Internal API route used by server actions. Gated by session auth.
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  if (!supabase)
    return NextResponse.json({ error: "Not configured." }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await request.json()) as SendBody;
  if (!body.client_id || !body.to || !body.body)
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });

  // Verify client belongs to this owner and has SMS consent.
  const { data: client } = await supabase
    .from("clients")
    .select("phone, sms_consent")
    .eq("id", body.client_id)
    .single();

  if (!client)
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  if (!client.sms_consent)
    return NextResponse.json({ error: "Client opted out of SMS." }, { status: 403 });

  // Write queued row first.
  const { data: msg } = await supabase
    .from("messages")
    .insert({
      owner_id: user.id,
      client_id: body.client_id,
      direction: "outbound",
      channel: "sms",
      body: body.body,
      template_key: body.template_key ?? null,
      language: body.language ?? null,
      status: "queued",
    })
    .select("id")
    .single();

  const result = await twilioSend(body.to, body.body);

  if (msg) {
    await supabase
      .from("messages")
      .update({
        status: result.ok ? "sent" : "failed",
        twilio_sid: result.sid ?? null,
      })
      .eq("id", (msg as { id: string }).id);
  }

  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 502 });

  return NextResponse.json({ ok: true, sid: result.sid });
}
