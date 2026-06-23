import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import StatusBadge from "@/components/StatusBadge";
import QuoteActions from "@/components/QuoteActions";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import type { Client, Quote, QuoteStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("quotes");
  const ts = await getTranslations("quotes.status");

  const supabase = await createSupabaseServer();
  if (!supabase) notFound();

  const { data } = await supabase
    .from("quotes")
    .select("*, client:clients(*)")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const q = data as Quote & { client: Client };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/quotes" className="text-sm text-cream/60 hover:text-cream">
          ← {t("title")}
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="font-serif text-3xl">{q.client.name}</h1>
          <StatusBadge status={q.status as QuoteStatus} label={ts(q.status as QuoteStatus)} />
        </div>
        <p className="text-sm text-cream/60">{new Date(q.created_at).toLocaleDateString()}</p>
      </div>

      {/* Line items */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-cream/50">
            <th className="pb-2">Service</th>
            <th className="pb-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {q.line_items.map((item, i) => (
            <tr key={i} className="border-b border-neutral-900">
              <td className="py-2">{item.name_en}</td>
              <td className="py-2 text-right">{formatCents(item.price * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="ml-auto w-48 space-y-1 text-sm">
        <div className="flex justify-between text-cream/60">
          <span>{t("subtotal")}</span><span>{formatCents(q.subtotal)}</span>
        </div>
        <div className="flex justify-between text-cream/60">
          <span>{t("gst")}</span><span>{formatCents(q.gst)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-700 pt-1 font-serif text-xl">
          <span>{t("total")}</span><span>{formatCents(q.total)}</span>
        </div>
      </div>

      {/* Public link */}
      {(q.status === "sent" || q.status === "accepted") && (
        <p className="text-sm text-cream/50 break-all">
          Public link: /q/{q.public_token}
        </p>
      )}

      {/* Actions */}
      <QuoteActions quoteId={q.id} status={q.status as QuoteStatus} locale={locale} />
    </div>
  );
}
