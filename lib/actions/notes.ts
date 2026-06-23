"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function addClientNote(
  clientId: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!note.trim()) return { ok: false, error: "Note cannot be empty." };

  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.from("clients").select("id").eq("id", clientId).single();
  if (error) return { ok: false, error: "Client not found." };

  // Notes are stored in the clients.notes field as append-only text for now.
  // When a dedicated client_notes table is preferred, swap this out.
  const { data: existing } = await supabase
    .from("clients")
    .select("notes")
    .eq("id", clientId)
    .single();

  const timestamp = new Date().toLocaleDateString("en-CA");
  const newNote = `[${timestamp}] ${note.trim()}`;
  const combined = existing?.notes
    ? `${existing.notes}\n${newNote}`
    : newNote;

  const { error: updateErr } = await supabase
    .from("clients")
    .update({ notes: combined })
    .eq("id", clientId);

  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath(`/[locale]/clients/${clientId}`, "page");
  return { ok: true };
}
