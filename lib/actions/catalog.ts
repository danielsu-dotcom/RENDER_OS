"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { dollarsToCents } from "@/lib/money";
import type { ServiceCatalogItem } from "@/lib/types";

export interface UpsertServiceInput {
  id?: string;
  name_en: string;
  name_zh: string;
  default_price_dollars: string; // raw string from form input
  description_en?: string;
  description_zh?: string;
}

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Fetch all catalog items including inactive ones (for the settings editor). */
export async function listAllServices(): Promise<ServiceCatalogItem[] | null> {
  const supabase = await createSupabaseServer();
  if (!supabase) return null;

  const { data } = await supabase
    .from("service_catalog")
    .select("*")
    .order("name_en");

  return (data ?? []) as ServiceCatalogItem[];
}

/** Create or update a service catalog item. */
export async function upsertService(
  input: UpsertServiceInput,
): Promise<ActionResult<ServiceCatalogItem>> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  if (!input.name_en.trim()) return { ok: false, error: "English name is required." };
  if (!input.name_zh.trim()) return { ok: false, error: "Chinese name is required." };

  const priceNum = parseFloat(input.default_price_dollars);
  if (isNaN(priceNum) || priceNum < 0) {
    return { ok: false, error: "Price must be a positive number." };
  }
  const default_price = dollarsToCents(priceNum);

  const payload = {
    owner_id: user.id,
    name_en: input.name_en.trim(),
    name_zh: input.name_zh.trim(),
    default_price,
    description_en: input.description_en?.trim() || null,
    description_zh: input.description_zh?.trim() || null,
    active: true,
  };

  let data: ServiceCatalogItem | null = null;

  if (input.id) {
    const { data: updated, error } = await supabase
      .from("service_catalog")
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    data = updated as ServiceCatalogItem;
  } else {
    const { data: created, error } = await supabase
      .from("service_catalog")
      .insert(payload)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    data = created as ServiceCatalogItem;
  }

  revalidatePath("/[locale]/settings", "page");
  revalidatePath("/[locale]/quotes/new", "page");
  return { ok: true, data: data! };
}

/** Toggle active/inactive on a catalog item. */
export async function toggleService(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const { error } = await supabase
    .from("service_catalog")
    .update({ active })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/settings", "page");
  revalidatePath("/[locale]/quotes/new", "page");
  return { ok: true };
}
