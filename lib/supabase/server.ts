import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Authenticated, request-scoped Supabase client for Server Components / actions.
// Returns null when env vars are absent so pages can degrade gracefully.
export async function createSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies are read-only —
          // the middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
