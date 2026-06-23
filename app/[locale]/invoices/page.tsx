import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import type { Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

type InvoiceRow = Invoice & {
  quote: { total: number; client: { name: string } | null } | null;
};

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("invoice");

  const supabase = await createSupabaseServer();
  if (!supabase) {
    return (
      <p className="bg-card p-6 text-sm text-charcoal/70">Connect Supabase to manage invoices.</p>
    );
  }

  const { data: allInvoices } = await supabase
    .from("invoices")
    .select("*, quote:quotes(total, client:clients(name))")
    .order("issued_at", { ascending: false });

  const invoices = (allInvoices ?? []) as InvoiceRow[];

  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const paid = invoices.filter((i) => i.status === "paid");

  const totalOwed = unpaid.reduce((sum, i) => sum + (i.quote?.total ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">{t("title")}s</h1>
      </div>

      {/* Summary */}
      <div className="bg-card p-4 text-charcoal">
        <p className="text-xs uppercase tracking-wide text-charcoal/50">Total outstanding</p>
        <p className="font-serif text-3xl">{formatCents(totalOwed)}</p>
        <p className="mt-0.5 text-sm text-charcoal/60">{unpaid.length} unpaid invoice{unpaid.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Unpaid */}
      <section>
        <h2 className="mb-3 font-serif text-xl">Unpaid</h2>
        {unpaid.length === 0 ? (
          <p className="text-sm text-cream/60">All caught up — no unpaid invoices.</p>
        ) : (
          <ul className="space-y-2">
            {unpaid.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between bg-amber-900/20 border border-amber-700/30 p-4 text-cream transition hover:opacity-90"
                >
                  <div>
                    <p className="font-medium">{inv.quote?.client?.name ?? "—"}</p>
                    <p className="text-sm text-cream/60">
                      Issued {new Date(inv.issued_at).toLocaleDateString("en-CA")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-lg">{formatCents(inv.quote?.total ?? 0)}</span>
                    <span className="bg-amber-700/50 px-2 py-0.5 text-xs font-medium text-amber-100">
                      Unpaid
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Paid */}
      {paid.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-xl">Paid</h2>
          <ul className="space-y-2">
            {paid.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between bg-card p-4 text-charcoal transition hover:opacity-90"
                >
                  <div>
                    <p className="font-medium">{inv.quote?.client?.name ?? "—"}</p>
                    <p className="text-sm text-charcoal/60">
                      Paid {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("en-CA") : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-lg">{formatCents(inv.quote?.total ?? 0)}</span>
                    <span className="bg-green-800 px-2 py-0.5 text-xs font-medium text-green-100">
                      Paid
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
