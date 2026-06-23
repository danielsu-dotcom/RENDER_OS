import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import StatusBadge from "@/components/StatusBadge";
import AddNoteForm from "@/components/AddNoteForm";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import type { Client, Invoice, Job, Message, Quote, QuoteStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// ── Timeline ─────────────────────────────────────────────────────────────────

type TimelineKind = "quote" | "job" | "invoice" | "message";

interface TimelineItem {
  at: string;
  kind: TimelineKind;
  id: string;
  title: string;
  detail?: string;
  quoteStatus?: QuoteStatus;
  invoiceStatus?: "unpaid" | "paid";
  direction?: "outbound" | "inbound";
}

const kindColors: Record<TimelineKind, string> = {
  quote: "bg-blue-900/30 border-blue-700/40",
  job: "bg-forest/20 border-forest/40",
  invoice: "bg-amber-900/30 border-amber-700/40",
  message: "bg-neutral-800 border-neutral-700",
};

function TimelineDot({ kind }: { kind: TimelineKind }) {
  const dotColor: Record<TimelineKind, string> = {
    quote: "bg-blue-400",
    job: "bg-green-500",
    invoice: "bg-amber-400",
    message: "bg-neutral-400",
  };
  return (
    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor[kind]}`} />
  );
}

// ── Warranty section ─────────────────────────────────────────────────────────

function WarrantyRow({ job, tExpires, tExpired }: { job: Job; tExpires: string; tExpired: string }) {
  const services = job.services.map((s) => s.name_en).join(", ") || "Job";
  const expiresAt = job.warranty_expires_at ? new Date(job.warranty_expires_at) : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  return (
    <div className="flex items-start justify-between bg-card p-3 text-charcoal">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{services}</p>
        {expiresAt && (
          <p className={`text-xs ${isExpired ? "text-red-500" : "text-charcoal/60"}`}>
            {isExpired ? tExpired : tExpires}:{" "}
            {expiresAt.toLocaleDateString("en-CA")}
          </p>
        )}
      </div>
      {!isExpired && expiresAt && (
        <span className="ml-2 shrink-0 bg-forest px-2 py-0.5 text-xs text-cream">
          Active
        </span>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");
  const tq = await getTranslations("quotes.status");

  const supabase = await createSupabaseServer();
  if (!supabase) {
    return (
      <p className="bg-card p-6 text-sm text-charcoal/70">{t("connectSupabase")}</p>
    );
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!client) notFound();
  const c = client as Client;

  const [
    { data: quotesRaw },
    { data: jobsRaw },
    { data: invoicesRaw },
    { data: messagesRaw },
  ] = await Promise.all([
    supabase.from("quotes").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("jobs").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("invoices").select("*, quote:quotes(total)").eq("client_id", id).order("issued_at", { ascending: false }),
    supabase.from("messages").select("*").eq("client_id", id).order("created_at", { ascending: false }),
  ]);

  const quotes = (quotesRaw ?? []) as Quote[];
  const jobs = (jobsRaw ?? []) as Job[];
  const invoices = (invoicesRaw ?? []) as (Invoice & { quote: { total: number } | null })[];
  const messages = (messagesRaw ?? []) as Message[];

  // Lifetime revenue from paid invoices.
  const lifetimeRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.quote?.total ?? 0), 0);

  // Active + recently expired warranties.
  const warrantyJobs = jobs.filter((j) => j.warranty_expires_at !== null);

  // Build sorted interleaved timeline.
  const timeline: TimelineItem[] = [
    ...quotes.map((q): TimelineItem => ({
      at: q.created_at,
      kind: "quote",
      id: q.id,
      title: `Quote · ${formatCents(q.total)}`,
      quoteStatus: q.status,
    })),
    ...jobs.map((j): TimelineItem => ({
      at: j.created_at,
      kind: "job",
      id: j.id,
      title: j.services.map((s) => s.name_en).join(", ") || "Job",
      detail: j.completed_at
        ? `Completed ${new Date(j.completed_at).toLocaleDateString("en-CA")}`
        : j.scheduled_date
        ? `Scheduled ${new Date(j.scheduled_date).toLocaleDateString("en-CA")}`
        : undefined,
    })),
    ...invoices.map((i): TimelineItem => ({
      at: i.issued_at,
      kind: "invoice",
      id: i.id,
      title: `Invoice · ${formatCents(i.quote?.total ?? 0)}`,
      invoiceStatus: i.status,
    })),
    ...messages.map((m): TimelineItem => ({
      at: m.created_at,
      kind: "message",
      id: m.id,
      title: m.body.length > 80 ? m.body.slice(0, 78) + "…" : m.body,
      direction: m.direction,
    })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  // Existing notes as array for display.
  const noteLines = c.notes
    ? c.notes.split("\n").filter(Boolean).reverse()
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/clients" className="text-sm text-cream/60 hover:text-cream">
          ← {t("backToClients")}
        </Link>
        <h1 className="mt-2 font-serif text-3xl">{c.name}</h1>
        <div className="mt-1 space-y-0.5 text-sm text-cream/70">
          {c.address && (
            <p>{c.address}{c.city ? `, ${c.city}` : ""}</p>
          )}
          <p>
            {formatPhone(c.phone)} · {t("language")}: {c.preferred_language.toUpperCase()}
          </p>
          {c.email && <p>{c.email}</p>}
        </div>
        <div className="mt-3 flex gap-2">
          <a href={`tel:${c.phone}`} className="bg-forest px-3 py-2 text-sm text-cream">
            {t("call")}
          </a>
          <a href={`sms:${c.phone}`} className="bg-neutral-800 px-3 py-2 text-sm text-cream">
            {t("text")}
          </a>
          <Link
            href={{ pathname: "/quotes/new", query: { clientId: c.id } }}
            className="bg-card px-3 py-2 text-sm text-charcoal"
          >
            New quote
          </Link>
        </div>
      </div>

      {/* Lifetime revenue */}
      <section>
        <p className="text-xs uppercase tracking-wide text-cream/50">{t("lifetimeRevenue")}</p>
        <p className="font-serif text-4xl">{formatCents(lifetimeRevenue)}</p>
      </section>

      {/* Warranty status */}
      <section>
        <h2 className="mb-3 font-serif text-xl">{t("warranty")}</h2>
        {warrantyJobs.length === 0 ? (
          <p className="text-sm text-cream/60">{t("noWarranty")}</p>
        ) : (
          <ul className="space-y-2">
            {warrantyJobs.map((j) => (
              <li key={j.id}>
                <WarrantyRow
                  job={j}
                  tExpires={t("warrantyExpires")}
                  tExpired={t("warrantyExpired")}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Interleaved timeline */}
      <section>
        <h2 className="mb-3 font-serif text-xl">{t("timeline")}</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-cream/60">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {timeline.map((item) => {
              const wrapper = (
                <div className={`flex gap-3 border p-3 ${kindColors[item.kind]}`}>
                  <TimelineDot kind={item.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm text-cream">{item.title}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.direction && (
                          <span className="text-xs text-cream/50">
                            {item.direction === "outbound" ? "→" : "←"}
                          </span>
                        )}
                        {item.quoteStatus && (
                          <StatusBadge status={item.quoteStatus} label={tq(item.quoteStatus)} />
                        )}
                        {item.invoiceStatus && (
                          <span
                            className={`px-1.5 py-0.5 text-xs font-medium ${
                              item.invoiceStatus === "paid"
                                ? "bg-green-800 text-green-100"
                                : "bg-amber-800 text-amber-100"
                            }`}
                          >
                            {item.invoiceStatus === "paid" ? "Paid" : "Unpaid"}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.detail && (
                      <p className="mt-0.5 text-xs text-cream/50">{item.detail}</p>
                    )}
                    <p className="mt-0.5 text-xs text-cream/40">
                      {new Date(item.at).toLocaleDateString("en-CA")}
                    </p>
                  </div>
                </div>
              );

              // Make quotes and invoices tappable links.
              if (item.kind === "quote") {
                return (
                  <li key={item.id}>
                    <Link href={`/quotes/${item.id}`} className="block hover:opacity-90">
                      {wrapper}
                    </Link>
                  </li>
                );
              }
              if (item.kind === "invoice") {
                return (
                  <li key={item.id}>
                    <Link href={`/invoices/${item.id}`} className="block hover:opacity-90">
                      {wrapper}
                    </Link>
                  </li>
                );
              }
              return <li key={item.id}>{wrapper}</li>;
            })}
          </ul>
        )}
      </section>

      {/* Notes */}
      <section>
        <h2 className="mb-3 font-serif text-xl">{t("notes")}</h2>
        <AddNoteForm clientId={c.id} />
        {noteLines.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {noteLines.map((line, i) => (
              <li key={i} className="bg-card p-3 text-sm text-charcoal">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-cream/60">{t("noNotes")}</p>
        )}
      </section>
    </div>
  );
}
