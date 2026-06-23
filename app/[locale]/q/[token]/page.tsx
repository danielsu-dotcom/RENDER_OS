import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import AcceptQuoteButton from "@/components/AcceptQuoteButton";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { docLabels } from "@/lib/templates";
import type { PublicQuote } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServer();
  if (!supabase) notFound();

  const { data } = await supabase.rpc("get_public_quote", { p_token: token });
  if (!data) notFound();
  const q = data as PublicQuote;

  // Client-facing language is driven by the CLIENT, not the URL locale.
  const L = docLabels[q.language];
  const hasRoofWash = q.line_items.some((i) =>
    i.name_en.toLowerCase().includes("roof"),
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="border-b border-neutral-700 pb-4">
        <p className="font-serif text-3xl">{L.business}</p>
        <p className="text-sm text-cream/60">{L.quote}</p>
      </header>

      <div className="text-sm text-cream/80">
        <p className="uppercase tracking-wide text-cream/50">{L.billedTo}</p>
        <p className="text-base">{q.client_name}</p>
        {q.client_address && (
          <p>
            {q.client_address}
            {q.client_city ? `, ${q.client_city}` : ""}
          </p>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-700 text-left text-cream/50">
            <th className="py-2">{L.item}</th>
            <th className="py-2 text-center">{L.qty}</th>
            <th className="py-2 text-right">{L.lineTotal}</th>
          </tr>
        </thead>
        <tbody>
          {q.line_items.map((item, i) => (
            <tr key={i} className="border-b border-neutral-800">
              <td className="py-2">
                {q.language === "zh" ? item.name_zh : item.name_en}
              </td>
              <td className="py-2 text-center">{item.qty}</td>
              <td className="py-2 text-right">
                {formatCents(item.price * item.qty)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-48 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-cream/60">{L.subtotal}</span>
          <span>{formatCents(q.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cream/60">{L.gst}</span>
          <span>{formatCents(q.gst)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-700 pt-1 font-serif text-lg">
          <span>{L.total}</span>
          <span>{formatCents(q.total)}</span>
        </div>
      </div>

      {hasRoofWash && (
        <p className="text-sm text-cream/70">
          <span className="font-medium">{L.warranty}: </span>
          {L.warrantyRoof}
        </p>
      )}

      {q.expires_at && (
        <p className="text-sm text-cream/60">
          {L.validUntil}: {new Date(q.expires_at).toLocaleDateString()}
        </p>
      )}

      {q.status === "accepted" ? (
        <p className="bg-forest p-4 text-center text-cream">{L.accepted}</p>
      ) : (
        <AcceptQuoteButton
          token={token}
          label={L.accept}
          acceptedLabel={L.accepted}
        />
      )}
    </div>
  );
}
