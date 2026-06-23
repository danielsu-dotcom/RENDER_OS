import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import ApprovalQueue from "@/components/ApprovalQueue";
import type { Message } from "@/lib/types";

export const dynamic = "force-dynamic";

type QueuedMessage = Message & {
  client: { name: string; phone: string } | null;
};

async function getPageData() {
  const supabase = await createSupabaseServer();
  if (!supabase) return null;

  const soon = new Date(Date.now() + 60 * 864e5).toISOString();

  const [awaiting, unpaid, dueSoon, queued] = await Promise.all([
    supabase
      .from("quotes")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent"),
    supabase
      .from("invoices")
      .select("quote:quotes(total)")
      .eq("status", "unpaid"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .not("warranty_expires_at", "is", null)
      .lte("warranty_expires_at", soon),
    supabase
      .from("messages")
      .select("*, client:clients(name, phone)")
      .eq("status", "queued")
      .eq("direction", "outbound")
      .order("created_at", { ascending: true }),
  ]);

  const moneyOwed = (unpaid.data ?? []).reduce(
    (sum, row) =>
      sum + (((row.quote as unknown) as { total: number } | null)?.total ?? 0),
    0,
  );

  return {
    quotesAwaiting: awaiting.count ?? 0,
    moneyOwed,
    dueForRebooking: dueSoon.count ?? 0,
    queuedMessages: (queued.data ?? []) as QueuedMessage[],
  };
}

function Stat({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link href={href} className="block bg-card p-6 text-charcoal transition hover:opacity-90">
      <p className="text-sm uppercase tracking-wide text-charcoal/60">{label}</p>
      <p className="mt-1 font-serif text-4xl">{value}</p>
    </Link>
  );
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const data = await getPageData();

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl">{t("title")}</h1>

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat href="/quotes?status=sent" label={t("quotesAwaiting")} value={String(data.quotesAwaiting)} />
            <Stat href="/invoices" label={t("moneyOwed")} value={formatCents(data.moneyOwed)} />
            <Stat href="/clients?attention=1" label={t("dueForRebooking")} value={String(data.dueForRebooking)} />
          </div>

          <section>
            <h2 className="mb-3 font-serif text-xl">
              {t("pendingMessages")}
              {data.queuedMessages.length > 0 && (
                <span className="ml-2 bg-forest px-2 py-0.5 text-sm font-sans text-cream">
                  {data.queuedMessages.length}
                </span>
              )}
            </h2>
            <ApprovalQueue
              messages={data.queuedMessages}
              noPendingLabel={t("noPending")}
            />
          </section>
        </>
      ) : (
        <div className="bg-card p-6 text-charcoal">
          <h2 className="font-serif text-xl">{t("connectSupabase")}</h2>
          <p className="mt-2 text-sm text-charcoal/70">{t("connectSupabaseHelp")}</p>
        </div>
      )}
    </div>
  );
}
