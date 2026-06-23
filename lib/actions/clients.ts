"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import type { Client, Locale } from "@/lib/types";

export interface ClientFormData {
  name: string;
  phone: string;
  preferred_language: Locale;
  email?: string;
  address?: string;
  city?: string;
}

export interface ClientResult {
  ok: true;
  client: Client;
  created: boolean;
}
export interface ClientError {
  ok: false;
  error: string;
}

/** Search clients by name or phone (partial, case-insensitive). */
export async function searchClients(query: string): Promise<Client[]> {
  const supabase = await createSupabaseServer();
  if (!supabase || !query.trim()) return [];

  const { data } = await supabase
    .from("clients")
    .select("*")
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .order("name")
    .limit(10);

  return (data ?? []) as Client[];
}

/** Find existing client by E.164 phone, or create a new one. */
export async function findOrCreateClient(
  data: ClientFormData,
): Promise<ClientResult | ClientError> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const phoneResult = normalizePhone(data.phone);
  if (!phoneResult.ok || !phoneResult.e164) {
    return { ok: false, error: phoneResult.error ?? "Invalid phone number." };
  }
  const e164 = phoneResult.e164;

  // Check for existing client with this phone (idempotent).
  const { data: existing } = await supabase
    .from("clients")
    .select("*")
    .eq("phone", e164)
    .maybeSingle();

  if (existing) {
    return { ok: true, client: existing as Client, created: false };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      owner_id: user.id,
      name: data.name.trim(),
      phone: e164,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      preferred_language: data.preferred_language,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, client: created as Client, created: true };
}
