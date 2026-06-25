import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import StatusBadge from "@/components/StatusBadge";
import { listQuotes } from "@/lib/actions/quotes";
import { formatCents } from "@/lib/money";
import type { Quote, QuoteStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type QuoteWithClient = Quote & {
  client: { name: string; preferred_language: string } | null;
};

const VALID_STATUSES: QuoteStatus[] = ["draft", "sent", "accepted", "declined", "expired"];

export default async function QuotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations("quotes");
  const ts = await getTranslations("quotes.status");

  const filterStatus = VALID_STATUSES.includes(sp.status as QuoteStatus)
    ? (sp.status as QuoteStatus)
    : undefined;

  const quotes = await listQuotes(filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">{t("title")}</h1>
        <Link
          href="/quotes/new"
          className="bg-forest px-4 py-2 text-sm font-medium text-cream"
        >
          + {t("newQuote")}
        </Link>
      </div>

      {quotes === null ? (
        <p className="bg-card p-6 text-sm text-charcoal/70">{t("connectSupabase")}</p>
      ) : quotes.length === 0 ? (
        <div className="space-y-4 py-12 text-center">
          <p className="text-cream/60">{t("empty")}</p>
          <Link
            href="/quotes/new"
            className="inline-block bg-forest px-6 py-3 font-medium text-cream"
          >
            {t("newQuote")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {(quotes as QuoteWithClient[]).map((q) => (
            <li key={q.id}>
              <Link
                href={`/quotes/${q.id}`}
                className="flex items-center justify-between bg-card p-4 text-charcoal transition hover:opacity-90"
              >
                <div>
                  <p className="font-medium">{q.client?.name ?? "—"}</p>
                  <p className="text-sm text-charcoal/60">
                    {new Date(q.created_at).toLocaleDateString("en-CA")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-serif text-lg">{formatCents(q.total)}</span>
                  <StatusBadge
                    status={q.status as QuoteStatus}
                    label={ts(q.status as QuoteStatus)}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
