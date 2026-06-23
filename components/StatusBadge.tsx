import type { QuoteStatus } from "@/lib/types";

// Quote status → brand-aligned colors.
const STYLES: Record<QuoteStatus, string> = {
  draft: "bg-neutral-500 text-white",
  sent: "bg-blue-700 text-white",
  accepted: "bg-forest text-cream",
  declined: "bg-red-700 text-white",
  expired: "bg-amber-600 text-white",
};

export default function StatusBadge({
  status,
  label,
}: {
  status: QuoteStatus;
  label?: string;
}) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${STYLES[status]}`}
    >
      {label ?? status}
    </span>
  );
}
