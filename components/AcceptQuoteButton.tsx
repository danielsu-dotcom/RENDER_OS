"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function AcceptQuoteButton({
  token,
  label,
  acceptedLabel,
}: {
  token: string;
  label: string;
  acceptedLabel: string;
}) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("accept_public_quote", {
        p_token: token,
      });
      if (!error) setAccepted(true);
    } finally {
      setLoading(false);
    }
  }

  if (accepted) {
    return <p className="bg-forest p-4 text-center text-cream">{acceptedLabel}</p>;
  }

  return (
    <button
      onClick={accept}
      disabled={loading}
      className="w-full bg-forest px-4 py-4 text-lg font-medium text-cream transition hover:opacity-90 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
