"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { totalsFromLineItems } from "@/lib/money";
import type { LineItem, Quote, Invoice } from "@/lib/types";

export interface CreateQuoteInput {
  client_id: string;
  line_items: LineItem[];
  /** If omitted, expires 30 days from now. */
  expires_at?: string;
}

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Create a quote in 'draft' status with computed totals. */
export async function createQuote(
  input: CreateQuoteInput,
): Promise<ActionResult<Quote>> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  if (!input.line_items.length) {
    return { ok: false, error: "Add at least one service." };
  }

  const { subtotal, gst, total } = totalsFromLineItems(input.line_items);
  const expires_at =
    input.expires_at ??
    new Date(Date.now() + 30 * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      owner_id: user.id,
      client_id: input.client_id,
      line_items: input.line_items,
      subtotal,
      gst,
      total,
      expires_at,
      status: "draft",
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]", "layout");
  return { ok: true, data: data as Quote };
}

/**
 * Transition a draft quote to 'sent'.
 * The actual SMS is fired separately (P2 Twilio action) — this just flips the
 * status via the server-side state-machine RPC.
 */
export async function sendQuote(quote_id: string): Promise<ActionResult<Quote>> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const { data, error } = await supabase
    .rpc("set_quote_status", { p_quote_id: quote_id, p_new_status: "sent" })
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]", "layout");
  return { ok: true, data: data as Quote };
}

/** One-tap conversion: accepted quote → invoice (idempotent). */
export async function createInvoice(
  quote_id: string,
): Promise<ActionResult<Invoice>> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Check for existing invoice (idempotent).
  const { data: existing } = await supabase
    .from("invoices")
    .select("*")
    .eq("quote_id", quote_id)
    .maybeSingle();

  if (existing) return { ok: true, data: existing as Invoice };

  const { data: quote } = await supabase
    .from("quotes")
    .select("client_id, status")
    .eq("id", quote_id)
    .single();

  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status !== "accepted") {
    return { ok: false, error: "Can only invoice accepted quotes." };
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      owner_id: user.id,
      quote_id,
      client_id: quote.client_id,
      status: "unpaid",
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]", "layout");
  return { ok: true, data: data as Invoice };
}

/** Fetch quotes for the operator (newest first), with client name joined. */
export async function listQuotes(status?: string) {
  const supabase = await createSupabaseServer();
  if (!supabase) return null;

  let q = supabase
    .from("quotes")
    .select("*, client:clients(name, preferred_language)")
    .order("created_at", { ascending: false });

  if (status) q = q.eq("status", status);

  const { data } = await q;
  return data ?? [];
}

/** Fetch the service catalog (active items only). */
export async function listServices() {
  const supabase = await createSupabaseServer();
  if (!supabase) return [];

  const { data } = await supabase
    .from("service_catalog")
    .select("*")
    .eq("active", true)
    .order("name_en");

  return data ?? [];
}
