"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { addClientNote } from "@/lib/actions/notes";

export default function AddNoteForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await addClientNote(clientId, note);
      if (!r.ok) { setError(r.error ?? "Failed to save note."); return; }
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        rows={3}
        className="w-full px-3 py-2 text-sm"
        placeholder="Add a note…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={pending}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={pending || !note.trim()}
        className="bg-forest px-4 py-2 text-sm font-medium text-cream disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save note"}
      </button>
    </form>
  );
}
