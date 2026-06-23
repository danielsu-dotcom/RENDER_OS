import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createSupabaseServer } from "@/lib/supabase/server";
import { signOut } from "./actions";
import "../globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif",
});

export const metadata: Metadata = {
  title: "Render OS",
  description: "Internal operations tool for Render Exteriors — Vancouver, BC",
  appleWebApp: {
    capable: true,
    title: "Render OS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("nav");
  const supabase = await createSupabaseServer();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  const nav = [
    { href: "/", label: t("dashboard") },
    { href: "/quotes/new", label: t("newQuote") },
    { href: "/quotes", label: t("quotes") },
    { href: "/clients", label: t("clients") },
    { href: "/settings", label: t("settings") },
  ];

  return (
    <html
      lang={locale}
      className={`${dmSans.variable} ${dmSerif.variable} antialiased`}
    >
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider>
          <header className="border-b border-neutral-800">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
              <Link href="/" className="font-serif text-2xl tracking-tight">
                Render<span className="text-forest"> OS</span>
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-cream/70 transition hover:text-cream"
                  >
                    {item.label}
                  </Link>
                ))}
                {user && (
                  <form action={signOut.bind(null, locale)}>
                    <button
                      type="submit"
                      className="text-cream/50 transition hover:text-cream"
                    >
                      {t("signOut")}
                    </button>
                  </form>
                )}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
