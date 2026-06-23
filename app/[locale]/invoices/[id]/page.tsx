import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { docLabels } from "@/lib/templates";
import type { Client, Invoice, Quote } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("invoice");

  const supabase = await createSupabaseServer();
  if (!supabase) notFound();

  const { data } = await supabase
    .from("invoices")
    .select("*, quote:quotes(*, client:clients(*))")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const inv = data as Invoice & {
    quote: Quote & { client: Client };
  };
  const q = inv.quote;
  const client = q.client;

  // Invoice uses the client's preferred_language for the document.
  const L = docLabels[client.preferred_language];

  // Operator's e-Transfer email comes from settings (placeholder for now).
  const etransferEmail = process.env.ETRANSFER_EMAIL ?? "billing@renderexteriors.ca";

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/quotes/${q.id}`} className="text-sm text-cream/60 hover:text-cream">
          ← {t("backToQuote")}
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="font-serif text-3xl">{L.invoice}</h1>
          <span
            className={`px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
              inv.status === "paid" ? "bg-forest text-cream" : "bg-amber-600 text-white"
            }`}
          >
            {t(`status.${inv.status}`)}
          </span>
        </div>
      </div>

      {/* Client */}
      <div className="text-sm text-cream/70">
        <p className="text-xs uppercase tracking-wide text-cream/40">{L.billedTo}</p>
        <p className="text-base text-cream">{client.name}</p>
        {client.address && <p>{client.address}{client.city ? `, ${client.city}` : ""}</p>}
      </div>

      {/* Line items */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-cream/50">
            <th className="pb-2">{L.item}</th>
            <th className="pb-2 text-right">{L.lineTotal}</th>
          </tr>
        </thead>
        <tbody>
          {q.line_items.map((item, i) => (
            <tr key={i} className="border-b border-neutral-900">
              <td className="py-2">
                {client.preferred_language === "zh" ? item.name_zh : item.name_en}
              </td>
              <td className="py-2 text-right">
                {formatCents(item.price * item.qty)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="ml-auto w-48 space-y-1 text-sm">
        <div className="flex justify-between text-cream/60">
          <span>{L.subtotal}</span><span>{formatCents(q.subtotal)}</span>
        </div>
        <div className="flex justify-between text-cream/60">
          <span>{L.gst}</span><span>{formatCents(q.gst)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-700 pt-1 font-serif text-xl">
          <span>{L.total}</span><span>{formatCents(q.total)}</span>
        </div>
      </div>

      {/* Payment instructions */}
      {inv.status === "unpaid" && (
        <div className="bg-card p-4 text-charcoal text-sm">
          <p className="font-medium">{L.eTransfer}</p>
          <p className="mt-1 text-charcoal/70">{etransferEmail}</p>
        </div>
      )}

      <p className="text-xs text-cream/40">
        Issued {new Date(inv.issued_at).toLocaleDateString()}
        {inv.paid_at && ` · Paid ${new Date(inv.paid_at).toLocaleDateString()}`}
      </p>
    </div>
  );
}
