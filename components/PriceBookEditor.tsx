"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { upsertService, toggleService } from "@/lib/actions/catalog";
import { formatCents } from "@/lib/money";
import type { ServiceCatalogItem } from "@/lib/types";

interface FormState {
  id?: string;
  name_en: string;
  name_zh: string;
  default_price_dollars: string;
  description_en: string;
  description_zh: string;
}

const EMPTY: FormState = {
  name_en: "",
  name_zh: "",
  default_price_dollars: "",
  description_en: "",
  description_zh: "",
};

function toFormState(item: ServiceCatalogItem): FormState {
  return {
    id: item.id,
    name_en: item.name_en,
    name_zh: item.name_zh,
    default_price_dollars: (item.default_price / 100).toFixed(2),
    description_en: item.description_en ?? "",
    description_zh: item.description_zh ?? "",
  };
}

export default function PriceBookEditor({
  items,
}: {
  items: ServiceCatalogItem[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openNew() {
    setForm(EMPTY);
    setEditing(true);
    setError(null);
  }

  function openEdit(item: ServiceCatalogItem) {
    setForm(toFormState(item));
    setEditing(true);
    setError(null);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await upsertService(form);
      if (!r.ok) { setError(r.error ?? "Failed to save."); return; }
      setEditing(false);
      router.refresh();
    });
  }

  function handleToggle(item: ServiceCatalogItem) {
    startTransition(async () => {
      await toggleService(item.id, !item.active);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Item list */}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex items-center justify-between p-3 ${
              item.active ? "bg-card text-charcoal" : "bg-neutral-900 text-cream/40"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {item.name_en}
                {!item.active && (
                  <span className="ml-2 text-xs text-cream/30">(disabled)</span>
                )}
              </p>
              <p className="text-xs text-charcoal/60 dark:text-cream/40">
                {item.name_zh} · {formatCents(item.default_price)}
              </p>
            </div>
            <div className="ml-3 flex shrink-0 gap-2">
              <button
                onClick={() => openEdit(item)}
                className="px-2 py-1 text-xs text-charcoal bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-cream"
                disabled={pending}
              >
                Edit
              </button>
              <button
                onClick={() => handleToggle(item)}
                className={`px-2 py-1 text-xs ${
                  item.active
                    ? "bg-red-900/40 text-red-300 hover:bg-red-900/60"
                    : "bg-forest/40 text-green-300 hover:bg-forest/60"
                }`}
                disabled={pending}
              >
                {item.active ? "Disable" : "Enable"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!editing ? (
        <button
          onClick={openNew}
          className="bg-forest px-4 py-2 text-sm font-medium text-cream"
        >
          + Add service
        </button>
      ) : (
        <form onSubmit={handleSave} className="space-y-3 border border-neutral-700 p-4">
          <p className="text-sm font-medium text-cream">
            {form.id ? "Edit service" : "New service"}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-cream/60">Name (EN)</label>
              <input
                className="w-full px-3 py-2 text-sm"
                value={form.name_en}
                onChange={(e) => set("name_en", e.target.value)}
                placeholder="House Washing"
                required
                disabled={pending}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-cream/60">Name (ZH)</label>
              <input
                className="w-full px-3 py-2 text-sm"
                value={form.name_zh}
                onChange={(e) => set("name_zh", e.target.value)}
                placeholder="房屋清洗"
                required
                disabled={pending}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-cream/60">Default price (CAD $)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 text-sm"
              value={form.default_price_dollars}
              onChange={(e) => set("default_price_dollars", e.target.value)}
              placeholder="299.00"
              required
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-cream/60">Description (EN, optional)</label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 text-sm"
                value={form.description_en}
                onChange={(e) => set("description_en", e.target.value)}
                disabled={pending}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-cream/60">Description (ZH, optional)</label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 text-sm"
                value={form.description_zh}
                onChange={(e) => set("description_zh", e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-forest px-4 py-2 text-sm font-medium text-cream disabled:opacity-40"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              className="bg-neutral-800 px-4 py-2 text-sm text-cream"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
