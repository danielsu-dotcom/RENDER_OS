"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { twilioSend } from "@/lib/twilio";
import type { Locale, Message } from "@/lib/types";

export interface QueueMessageInput {
  client_id: string;
  to: string; // E.164 phone
  body: string;
  template_key?: string;
  language?: Locale;
}

/**
 * Queue a message in the DB (status='queued'), then immediately attempt
 * to send it via Twilio and update the status.
 * The DB row is written first so nothing is ever lost.
 */
export async function sendMessage(
  input: QueueMessageInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // 1. Write the row as 'queued' first.
  const { data: msg, error: insertErr } = await supabase
    .from("messages")
    .insert({
      owner_id: user.id,
      client_id: input.client_id,
      direction: "outbound",
      channel: "sms",
      body: input.body,
      template_key: input.template_key ?? null,
      language: input.language ?? null,
      status: "queued",
    })
    .select()
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };

  // 2. Send via Twilio.
  const result = await twilioSend(input.to, input.body);

  // 3. Update the row with the outcome.
  await supabase
    .from("messages")
    .update({
      status: result.ok ? "sent" : "failed",
      twilio_sid: result.sid ?? null,
    })
    .eq("id", (msg as Message).id);

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/**
 * Queue a message for approval (status stays 'queued', no Twilio call yet).
 * Used by the automation cron — the operator approves from the dashboard.
 */
export async function queueForApproval(
  ownerId: string,
  input: QueueMessageInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const { data, error } = await supabase
    .from("messages")
    .insert({
      owner_id: ownerId,
      client_id: input.client_id,
      direction: "outbound",
      channel: "sms",
      body: input.body,
      template_key: input.template_key ?? null,
      language: input.language ?? null,
      status: "queued",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

/** Approve a queued message — send it now via Twilio. */
export async function approveMessage(
  messageId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const { data: msg } = await supabase
    .from("messages")
    .select("*, client:clients(phone, sms_consent)")
    .eq("id", messageId)
    .single();

  if (!msg) return { ok: false, error: "Message not found." };

  const m = msg as Message & {
    client: { phone: string; sms_consent: boolean } | null;
  };

  if (!m.client?.sms_consent) {
    await supabase
      .from("messages")
      .update({ status: "failed" })
      .eq("id", messageId);
    return { ok: false, error: "Client has opted out of SMS." };
  }

  const result = await twilioSend(m.client.phone, m.body);

  await supabase
    .from("messages")
    .update({
      status: result.ok ? "sent" : "failed",
      twilio_sid: result.sid ?? null,
    })
    .eq("id", messageId);

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/** Dismiss (delete) a queued message without sending. */
export async function dismissMessage(
  messageId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("status", "queued");

  return error ? { ok: false, error: error.message } : { ok: true };
}
