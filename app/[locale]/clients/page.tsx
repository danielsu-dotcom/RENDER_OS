import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ClientCard from "@/components/ClientCard";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ attention?: string }>;
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations("clients");

  const attentionOnly = sp.attention === "1";

  const supabase = await createSupabaseServer();
  if (!supabase) {
    return (
      <p className="bg-card p-6 text-sm text-charcoal/70">{t("connectSupabase")}</p>
    );
  }

  let clients: Client[] = [];

  if (attentionOnly) {
    // Clients with a warranty expiring within the next 60 days or recently expired.
    const soon = new Date(Date.now() + 60 * 86_400_000).toISOString();
    const past = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const { data: jobs } = await supabase
      .from("jobs")
      .select("client_id")
      .not("warranty_expires_at", "is", null)
      .gte("warranty_expires_at", past)
      .lte("warranty_expires_at", soon);

    const clientIds = [...new Set((jobs ?? []).map((j: { client_id: string }) => j.client_id))];

    if (clientIds.length > 0) {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .in("id", clientIds)
        .order("created_at", { ascending: false });
      clients = (data ?? []) as Client[];
    }
  } else {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    clients = (data ?? []) as Client[];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">{t("title")}</h1>
          {attentionOnly && (
            <p className="mt-0.5 text-sm text-cream/60">
              Warranty due / expiring ·{" "}
              <Link href="/clients" className="underline">
                Show all
              </Link>
            </p>
          )}
        </div>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-cream/60">
          {attentionOnly
            ? "No clients with warranties expiring soon."
            : t("empty")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}
