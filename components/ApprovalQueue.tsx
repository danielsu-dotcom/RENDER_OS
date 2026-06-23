"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { approveMessage, dismissMessage } from "@/lib/actions/messages";
import type { Message } from "@/lib/types";

type QueuedMessage = Message & {
  client: { name: string; phone: string } | null;
};

export default function ApprovalQueue({
  messages,
  noPendingLabel,
}: {
  messages: QueuedMessage[];
  noPendingLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function act(id: string, action: "approve" | "dismiss") {
    setErrors((prev) => ({ ...prev, [id]: "" }));
    startTransition(async () => {
      const result =
        action === "approve"
          ? await approveMessage(id)
          : await dismissMessage(id);
      if (!result.ok) {
        setErrors((prev) => ({ ...prev, [id]: result.error ?? "Failed." }));
      } else {
        router.refresh();
      }
    });
  }

  if (messages.length === 0) {
    return <p className="text-sm text-cream/60">{noPendingLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {messages.map((msg) => (
        <li key={msg.id} className="bg-neutral-900 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-cream">
                {msg.client?.name ?? msg.client?.phone ?? "Unknown"}
              </p>
              <p className="mt-0.5 text-sm text-cream/60 line-clamp-2">
                {msg.body}
              </p>
              {msg.template_key && (
                <p className="mt-0.5 text-xs text-cream/30 uppercase tracking-wide">
                  {msg.template_key} · {msg.language}
                </p>
              )}
            </div>
          </div>
          {errors[msg.id] && (
            <p className="text-xs text-red-400">{errors[msg.id]}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => act(msg.id, "approve")}
              disabled={pending}
              className="flex-1 bg-forest py-2 text-sm font-medium text-cream disabled:opacity-40"
            >
              Approve & Send
            </button>
            <button
              onClick={() => act(msg.id, "dismiss")}
              disabled={pending}
              className="flex-1 bg-neutral-800 py-2 text-sm text-cream/60 disabled:opacity-40"
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
