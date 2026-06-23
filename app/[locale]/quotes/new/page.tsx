import { setRequestLocale } from "next-intl/server";
import QuoteWizard from "@/components/QuoteWizard";
import { listServices } from "@/lib/actions/quotes";

export default async function NewQuotePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const catalog = await listServices();

  return (
    <div className="mx-auto max-w-lg">
      <QuoteWizard catalog={catalog} locale={locale} />
    </div>
  );
}
