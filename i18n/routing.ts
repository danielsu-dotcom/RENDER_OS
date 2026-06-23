import { defineRouting } from "next-intl/routing";

// App locale (what the OPERATOR sees). Distinct from clients.preferred_language,
// which drives client-facing quotes/SMS.
export const routing = defineRouting({
  locales: ["en", "zh"],
  defaultLocale: "en",
});
