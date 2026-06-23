import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { renderSms } from "@/lib/templates";
import type { Locale } from "@/lib/types";
import { twilioSend } from "@/lib/twilio";

export const runtime = "nodejs";

// ── helpers ──────────────────────────────────────────────────────────────────

// Service client bypasses RLS via service_role key. We use SupabaseClient<any>
// because we have no generated DB types — inserts/selects are cast as needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SC = SupabaseClient<any>;

function getServiceClient(): SC | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient(url, key) as SC;
}

/** Pacific time hour (0-23) right now. */
function pacificHour(): number {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Vancouver" }),
  ).getHours();
}

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://renderexteriors.ca";
const REVIEW_LINK =
  process.env.GOOGLE_REVIEW_LINK ?? "https://g.page/r/render-exteriors";

interface Client {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  preferred_language: Locale;
  sms_consent: boolean;
}

interface QueueArgs {
  supabase: SC;
  ownerId: string;
  client: Client;
  body: string;
  templateKey: string;
  quoteId?: string;
  jobId?: string;
}

/** Write automation_log + message row, then send via Twilio. */
async function queueAndSend({
  supabase,
  ownerId,
  client,
  body,
  templateKey,
  quoteId,
  jobId,
}: QueueArgs) {
  if (!client.sms_consent) return;

  // Write message first.
  const { data: msg } = await supabase
    .from("messages")
    .insert({
      owner_id: ownerId,
      client_id: client.id,
      direction: "outbound",
      channel: "sms",
      body,
      template_key: templateKey,
      language: client.preferred_language,
      status: "queued",
    })
    .select("id")
    .single();

  // Lock the automation_log row (unique index prevents double-send).
  const logInsert = await supabase.from("automation_log").insert({
    owner_id: ownerId,
    type: templateKey,
    client_id: client.id,
    quote_id: quoteId ?? null,
    job_id: jobId ?? null,
  });

  if (logInsert.error) {
    // Unique constraint violation — already sent. Clean up the message.
    if (msg) {
      await supabase.from("messages").delete().eq("id", (msg as { id: string }).id);
    }
    return;
  }

  const result = await twilioSend(client.phone, body);
  if (msg) {
    await supabase
      .from("messages")
      .update({ status: result.ok ? "sent" : "failed", twilio_sid: result.sid ?? null })
      .eq("id", (msg as { id: string }).id);
  }
}

// ── cron handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Vercel Cron auth header.
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const hour = pacificHour();
  if (hour < 9 || hour >= 19) {
    return NextResponse.json({ skipped: "outside sending window" });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const now = new Date();
  const d2 = new Date(now.getTime() - 2 * 86_400_000).toISOString();
  const d7 = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const d11m = new Date(now.getTime() - 335 * 86_400_000).toISOString();
  const d12m = new Date(now.getTime() - 365 * 86_400_000).toISOString();

  const counts = {
    quote_followup_d2: 0,
    quote_followup_d7: 0,
    quote_expiry: 0,
    rebooking: 0,
    review_request: 0,
    warranty_inspection: 0,
  };

  // ── Fetch all owners (multi-tenancy ready) ────────────────────────────────
  const { data: owners } = await supabase.auth.admin.listUsers();
  const ownerIds = (owners?.users ?? []).map((u) => u.id);

  for (const ownerId of ownerIds) {
    // ── 1. Quote follow-up D2 ──────────────────────────────────────────────
    const { data: d2Quotes } = await supabase
      .from("quotes")
      .select("id, public_token, client:clients!inner(*)")
      .eq("owner_id", ownerId)
      .eq("status", "sent")
      .lt("sent_at", d2)
      .gte("sent_at", d7); // not yet eligible for D7

    for (const q of d2Quotes ?? []) {
      const client = q.client as unknown as Client;
      const body = renderSms("quote_followup_d2", client.preferred_language, {
        first_name: client.name.split(" ")[0],
        quote_link: `${BASE_URL}/q/${q.public_token}`,
      });
      await queueAndSend({ supabase, ownerId, client, body, templateKey: "quote_followup_d2", quoteId: q.id });
      counts.quote_followup_d2++;
    }

    // ── 2. Quote follow-up D7 ──────────────────────────────────────────────
    const { data: d7Quotes } = await supabase
      .from("quotes")
      .select("id, public_token, client:clients!inner(*)")
      .eq("owner_id", ownerId)
      .eq("status", "sent")
      .lt("sent_at", d7);

    for (const q of d7Quotes ?? []) {
      const client = q.client as unknown as Client;
      const body = renderSms("quote_followup_d7", client.preferred_language, {
        first_name: client.name.split(" ")[0],
        quote_link: `${BASE_URL}/q/${q.public_token}`,
      });
      await queueAndSend({ supabase, ownerId, client, body, templateKey: "quote_followup_d7", quoteId: q.id });
      counts.quote_followup_d7++;
    }

    // ── 3. Quote expiry ───────────────────────────────────────────────────
    await supabase
      .from("quotes")
      .update({ status: "expired" })
      .eq("owner_id", ownerId)
      .eq("status", "sent")
      .lt("expires_at", now.toISOString());
    // Status machine trigger enforces the transition; count not tracked.

    // ── 4. Rebooking (~11 months after last completed job) ─────────────────
    const { data: rebookJobs } = await supabase
      .from("jobs")
      .select("id, client_id, services, client:clients!inner(*)")
      .eq("owner_id", ownerId)
      .lt("completed_at", d11m)
      .not("completed_at", "is", null);

    for (const j of rebookJobs ?? []) {
      const client = j.client as unknown as Client;
      // Skip if a newer job exists.
      const { count: newer } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", ownerId)
        .eq("client_id", client.id)
        .gte("created_at", d11m);
      if ((newer ?? 0) > 0) continue;

      // Skip if already sent a rebooking in last 60 days.
      const d60 = new Date(now.getTime() - 60 * 86_400_000).toISOString();
      const { count: recent } = await supabase
        .from("automation_log")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", ownerId)
        .eq("type", "rebooking")
        .eq("client_id", client.id)
        .gte("fired_at", d60);
      if ((recent ?? 0) > 0) continue;

      const services = Array.isArray(j.services)
        ? (j.services as Array<{ name_en: string }>).map((s) => s.name_en).join(", ")
        : "";
      const body = renderSms("rebooking", client.preferred_language, {
        first_name: client.name.split(" ")[0],
        service: services,
      });
      await queueAndSend({ supabase, ownerId, client, body, templateKey: "rebooking", jobId: j.id });
      counts.rebooking++;
    }

    // ── 5. Review request (once per completed job) ─────────────────────────
    const { data: completedJobs } = await supabase
      .from("jobs")
      .select("id, services, client:clients!inner(*)")
      .eq("owner_id", ownerId)
      .not("completed_at", "is", null);

    for (const j of completedJobs ?? []) {
      const client = j.client as unknown as Client;
      const services = Array.isArray(j.services)
        ? (j.services as Array<{ name_en: string }>).map((s) => s.name_en).join(", ")
        : "";
      const body = renderSms("review_request", client.preferred_language, {
        first_name: client.name.split(" ")[0],
        service: services,
        review_link: REVIEW_LINK,
      });
      await queueAndSend({ supabase, ownerId, client, body, templateKey: "review_request", jobId: j.id });
      counts.review_request++;
    }

    // ── 6. Warranty inspection (12 months after completion) ───────────────
    const { data: warrantyJobs } = await supabase
      .from("jobs")
      .select("id, services, client:clients!inner(*)")
      .eq("owner_id", ownerId)
      .not("warranty_months", "is", null)
      .lt("completed_at", d12m)
      .gte("completed_at", new Date(now.getTime() - 395 * 86_400_000).toISOString());

    for (const j of warrantyJobs ?? []) {
      const client = j.client as unknown as Client;
      const services = Array.isArray(j.services)
        ? (j.services as Array<{ name_en: string }>).map((s) => s.name_en).join(", ")
        : "";
      const body = renderSms("warranty_inspection", client.preferred_language, {
        first_name: client.name.split(" ")[0],
        service: services,
      });
      await queueAndSend({ supabase, ownerId, client, body, templateKey: "warranty_inspection", jobId: j.id });
      counts.warranty_inspection++;
    }
  }

  return NextResponse.json({ ok: true, counts });
}
