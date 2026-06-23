import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import PriceBookEditor from "@/components/PriceBookEditor";
import { listAllServices } from "@/lib/actions/catalog";

export const dynamic = "force-dynamic";

// Automation schedule display (mirrors cron rules in app/api/cron/route.ts).
const AUTOMATION_RULES = [
  { label: "Quote follow-up #1", when: "2 days after quote sent, if no response" },
  { label: "Quote follow-up #2", when: "7 days after quote sent, if no response" },
  { label: "Rebooking reminder", when: "~11 months after last completed job" },
  { label: "Review request", when: "Once per completed job" },
  { label: "Warranty inspection", when: "12 months after job completion" },
];

function EnvRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between border-b border-neutral-800 py-2 last:border-0">
      <span className="text-sm text-cream/60">{label}</span>
      <span className="text-sm font-mono text-cream/90">
        {value ? value : <span className="text-red-400">not set</span>}
      </span>
    </div>
  );
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const services = await listAllServices();

  return (
    <div className="space-y-12">
      <h1 className="font-serif text-3xl">Settings</h1>

      {/* Language toggle */}
      <section>
        <h2 className="mb-3 font-serif text-xl">Operator language</h2>
        <div className="flex gap-2">
          <Link
            href="/settings"
            locale="en"
            className={`px-4 py-2 text-sm font-medium ${
              locale === "en" ? "bg-forest text-cream" : "bg-card text-charcoal"
            }`}
          >
            English
          </Link>
          <Link
            href="/settings"
            locale="zh"
            className={`px-4 py-2 text-sm font-medium ${
              locale === "zh" ? "bg-forest text-cream" : "bg-card text-charcoal"
            }`}
          >
            中文
          </Link>
        </div>
        <p className="mt-2 text-xs text-cream/50">
          Switches the operator interface language. Client-facing documents always use the client&apos;s preferred language.
        </p>
      </section>

      {/* Business profile */}
      <section>
        <h2 className="mb-1 font-serif text-xl">Business profile</h2>
        <p className="mb-3 text-xs text-cream/50">
          These values come from environment variables. Edit <code className="text-cream/80">.env.local</code> (dev) or your Vercel project settings (production) to change them.
        </p>
        <div className="bg-card p-4 text-charcoal">
          <EnvRow label="e-Transfer email" value={process.env.ETRANSFER_EMAIL} />
          <EnvRow label="Public base URL" value={process.env.NEXT_PUBLIC_BASE_URL} />
          <EnvRow label="Google review link" value={process.env.GOOGLE_REVIEW_LINK} />
          <EnvRow label="Twilio from number" value={process.env.TWILIO_FROM_NUMBER} />
        </div>
      </section>

      {/* Price book */}
      <section>
        <h2 className="mb-1 font-serif text-xl">Price book</h2>
        <p className="mb-3 text-xs text-cream/50">
          Active services appear in the quote wizard. Disabled services are hidden from new quotes but preserved on existing ones.
        </p>
        {services === null ? (
          <p className="text-sm text-cream/60">Connect Supabase to manage the price book.</p>
        ) : (
          <PriceBookEditor items={services} />
        )}
      </section>

      {/* Automation schedule */}
      <section>
        <h2 className="mb-1 font-serif text-xl">Automation schedule</h2>
        <p className="mb-3 text-xs text-cream/50">
          The cron runs daily at 9 am Pacific. All messages are sent between 9 am–7 pm Pacific. Adjust timing in <code className="text-cream/80">vercel.json</code> and <code className="text-cream/80">app/api/cron/route.ts</code>.
        </p>
        <ul className="space-y-1">
          {AUTOMATION_RULES.map((r) => (
            <li key={r.label} className="flex justify-between bg-card p-3 text-charcoal">
              <span className="text-sm font-medium">{r.label}</span>
              <span className="text-sm text-charcoal/60">{r.when}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
