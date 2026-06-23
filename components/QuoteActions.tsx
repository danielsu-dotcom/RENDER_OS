"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { sendQuote, createInvoice } from "@/lib/actions/quotes";
import { canTransition } from "@/lib/quote-status";
import type { QuoteStatus } from "@/lib/types";

export default function QuoteActions({
  quoteId,
  status,
  locale,
}: {
  quoteId: string;
  status: QuoteStatus;
  locale: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const r = await sendQuote(quoteId);
      if (!r.ok) { setError(r.error ?? "Failed to send."); return; }
      router.refresh();
    });
  }

  function handleInvoice() {
    setError(null);
    startTransition(async () => {
      const r = await createInvoice(quoteId);
      if (!r.ok) { setError(r.error ?? "Failed to create invoice."); return; }
      router.push(`/invoices/${r.data!.id}`);
    });
  }

  return (
    <div className="space-y-3 pt-2">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        {canTransition(status, "sent") && (
          <button
            onClick={handleSend}
            disabled={pending}
            className="flex-1 bg-forest py-4 text-base font-medium text-cream disabled:opacity-40"
          >
            {pending ? "Sending…" : "Send to client"}
          </button>
        )}
        {status === "accepted" && (
          <button
            onClick={handleInvoice}
            disabled={pending}
            className="flex-1 bg-forest py-4 text-base font-medium text-cream disabled:opacity-40"
          >
            {pending ? "Creating…" : "Create Invoice"}
          </button>
        )}
      </div>
    </div>
  );
}
