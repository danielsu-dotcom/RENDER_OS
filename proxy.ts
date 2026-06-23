import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Routes (after the /[locale] prefix) that don't require a session.
const PUBLIC_PATHS = ["/login", "/q"];

function isPublicPath(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/(en|zh)(?=\/|$)/, "");
  return PUBLIC_PATHS.some(
    (p) => withoutLocale === p || withoutLocale.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  // 1. Locale routing (redirect/rewrite) — builds the base response.
  const response = intlMiddleware(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Auth gating only activates once Supabase is configured — keeps the
  // unconfigured preview fully browsable.
  if (!url || !key) return response;

  // 2. Refresh the Supabase session and mirror cookies onto the response.
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) =>
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        ),
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3. Gate private routes.
  const { pathname } = request.nextUrl;
  if (!user && !isPublicPath(pathname)) {
    const locale = pathname.split("/")[1] || routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
