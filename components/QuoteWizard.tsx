"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { searchClients, findOrCreateClient } from "@/lib/actions/clients";
import { createQuote } from "@/lib/actions/quotes";
import { formatCents, dollarsToCents, totalsFromLineItems } from "@/lib/money";
import type { Client, LineItem, ServiceCatalogItem } from "@/lib/types";

// ── shared styles ────────────────────────────────────────────────────────────
const btn =
  "flex-1 bg-forest px-4 py-4 text-base font-medium text-cream disabled:opacity-40 active:opacity-80";
const ghost =
  "flex-1 bg-neutral-800 px-4 py-4 text-base font-medium text-cream/70 disabled:opacity-40";
const field =
  "w-full px-3 py-3 text-base";
const label = "block text-sm text-cream/60 mb-1";

// ── types ────────────────────────────────────────────────────────────────────
type Step = "client" | "services" | "review";

interface WizardItem extends LineItem {
  _key: string; // stable React key
}

// ── Step 1: Client ────────────────────────────────────────────────────────────
function ClientStep({
  onSelect,
}: {
  onSelect: (c: Client) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [mode, setMode] = useState<"search" | "create">("search");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSearch(q: string) {
    setQuery(q);
    startTransition(async () => {
      setResults(await searchClients(q));
    });
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await findOrCreateClient({
        name,
        phone: phone || undefined,
        address: address || undefined,
        email: email || undefined,
      });
      if (!res.ok) { setError(res.error); return; }
      onSelect(res.client);
    });
  }

  if (mode === "create") {
    return (
      <div className="space-y-4">
        <h2 className="font-serif text-2xl">New client</h2>
        <div>
          <label className={label}>Name</label>
          <input className={field} value={name} onChange={e => setName(e.target.value)} placeholder="Full name" autoFocus />
        </div>
        <div>
          <label className={label}>Phone <span className="text-cream/30">optional</span></label>
          <input className={field} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="604-555-0100" />
        </div>
        <div>
          <label className={label}>Address <span className="text-cream/30">optional</span></label>
          <input className={field} value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, Vancouver" />
        </div>
        <div>
          <label className={label}>Email <span className="text-cream/30">optional</span></label>
          <input className={field} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="button" className={ghost} onClick={() => setMode("search")}>Back</button>
          <button
            type="button"
            className={btn}
            disabled={!name.trim() || pending}
            onClick={handleCreate}
          >
            {pending ? "Saving…" : "Continue →"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl">Who's this for?</h2>
      <input
        className={field}
        placeholder="Search by name or phone…"
        value={query}
        onChange={e => handleSearch(e.target.value)}
        autoFocus
      />
      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map(c => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full bg-card p-4 text-left text-charcoal"
                onClick={() => onSelect(c)}
              >
                <p className="font-medium">{c.name}</p>
                {c.phone && <p className="text-sm text-charcoal/60">{c.phone}</p>}
                {c.address && <p className="text-sm text-charcoal/60">{c.address}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="w-full bg-neutral-800 py-4 text-center text-cream/70"
        onClick={() => setMode("create")}
      >
        + New client
      </button>
    </div>
  );
}

// ── Step 2: Services ──────────────────────────────────────────────────────────
function ServicesStep({
  catalog,
  items,
  onChange,
  onBack,
  onNext,
}: {
  catalog: ServiceCatalogItem[];
  items: WizardItem[];
  onChange: (items: WizardItem[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  function toggleCatalog(s: ServiceCatalogItem) {
    const exists = items.find(i => i.service_id === s.id);
    if (exists) {
      onChange(items.filter(i => i.service_id !== s.id));
    } else {
      onChange([
        ...items,
        {
          _key: s.id,
          service_id: s.id,
          name_en: s.name_en,
          name_zh: s.name_zh,
          price: s.default_price,
          qty: 1,
        },
      ]);
    }
  }

  function updatePrice(key: string, dollars: string) {
    onChange(
      items.map(i =>
        i._key === key ? { ...i, price: dollarsToCents(dollars) } : i,
      ),
    );
  }

  function addCustom() {
    if (!customName.trim()) return;
    const price = dollarsToCents(customPrice || "0");
    onChange([
      ...items,
      {
        _key: `custom-${Date.now()}`,
        service_id: null,
        name_en: customName.trim(),
        name_zh: customName.trim(),
        price,
        qty: 1,
      },
    ]);
    setCustomName("");
    setCustomPrice("");
  }

  const { total } = totalsFromLineItems(items);

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl">Select services</h2>

      {/* Catalog tiles */}
      <div className="grid grid-cols-2 gap-2">
        {catalog.map(s => {
          const active = items.some(i => i.service_id === s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleCatalog(s)}
              className={`p-4 text-left ${active ? "bg-forest text-cream" : "bg-neutral-800 text-cream/80"}`}
            >
              <p className="font-medium text-sm">{s.name_en}</p>
              <p className="text-xs opacity-70 mt-0.5">{formatCents(s.default_price)}</p>
            </button>
          );
        })}
      </div>

      {/* Price overrides for selected items */}
      {items.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-cream/50">Adjust prices</p>
          {items.map(item => (
            <div key={item._key} className="flex items-center gap-2 bg-neutral-900 px-3 py-2">
              <span className="flex-1 text-sm">{item.name_en}</span>
              <span className="text-cream/40 text-sm">$</span>
              <input
                type="number"
                className="w-24 bg-transparent text-right text-sm text-cream border-b border-neutral-700 focus:border-forest outline-none py-0.5"
                defaultValue={(item.price / 100).toFixed(2)}
                onChange={e => updatePrice(item._key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Custom line item */}
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 text-sm"
          placeholder="Custom item…"
          value={customName}
          onChange={e => setCustomName(e.target.value)}
        />
        <input
          type="number"
          className="w-24 px-3 py-2 text-sm"
          placeholder="$0"
          value={customPrice}
          onChange={e => setCustomPrice(e.target.value)}
        />
        <button
          type="button"
          onClick={addCustom}
          className="bg-neutral-800 px-3 py-2 text-sm text-cream/70"
        >
          Add
        </button>
      </div>

      {/* Running total */}
      {items.length > 0 && (
        <p className="text-right font-serif text-xl">
          {formatCents(total)}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button type="button" className={ghost} onClick={onBack}>Back</button>
        <button
          type="button"
          className={btn}
          disabled={items.length === 0}
          onClick={onNext}
        >
          Review →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Review ────────────────────────────────────────────────────────────
function ReviewStep({
  client,
  items,
  onBack,
  onSave,
  pending,
  error,
}: {
  client: Client;
  items: WizardItem[];
  onBack: () => void;
  onSave: () => void;
  pending: boolean;
  error: string | null;
}) {
  const { subtotal, gst, total } = totalsFromLineItems(items);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl">Review quote</h2>
        <p className="text-sm text-cream/60 mt-0.5">
          {client.name}{client.phone ? ` · ${client.phone}` : ""}
        </p>
      </div>

      {/* Line items */}
      <ul className="divide-y divide-neutral-800">
        {items.map(item => (
          <li key={item._key} className="flex justify-between py-2 text-sm">
            <span>{item.name_en}</span>
            <span>{formatCents(item.price * item.qty)}</span>
          </li>
        ))}
      </ul>

      {/* Totals */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-cream/60">
          <span>Subtotal</span><span>{formatCents(subtotal)}</span>
        </div>
        <div className="flex justify-between text-cream/60">
          <span>GST (5%)</span><span>{formatCents(gst)}</span>
        </div>
        <div className="flex justify-between font-serif text-xl pt-1 border-t border-neutral-800">
          <span>Total</span><span>{formatCents(total)}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="button" className={ghost} onClick={onBack} disabled={pending}>Back</button>
        <button type="button" className={btn} onClick={onSave} disabled={pending}>
          {pending ? "Saving…" : "Save quote"}
        </button>
      </div>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export default function QuoteWizard({
  catalog,
  locale,
}: {
  catalog: ServiceCatalogItem[];
  locale: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("client");
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<WizardItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleClientSelect = useCallback((c: Client) => {
    setClient(c);
    setStep("services");
  }, []);

  function save() {
    if (!client) return;
    setError(null);
    startTransition(async () => {
      const created = await createQuote({ client_id: client.id, line_items: items });
      if (!created.ok || !created.data) { setError(created.error ?? "Failed to create quote."); return; }
      router.push("/quotes");
    });
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex gap-1">
        {(["client", "services", "review"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 ${step === s || (i < ["client","services","review"].indexOf(step)) ? "bg-forest" : "bg-neutral-800"}`}
          />
        ))}
      </div>

      {step === "client" && <ClientStep onSelect={handleClientSelect} />}
      {step === "services" && (
        <ServicesStep
          catalog={catalog}
          items={items}
          onChange={setItems}
          onBack={() => setStep("client")}
          onNext={() => setStep("review")}
        />
      )}
      {step === "review" && client && (
        <ReviewStep
          client={client}
          items={items}
          onBack={() => setStep("services")}
          onSave={save}
          pending={pending}
          error={error}
        />
      )}
    </div>
  );
}
