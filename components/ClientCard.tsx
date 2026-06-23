import { Link } from "@/i18n/navigation";
import { formatPhone } from "@/lib/phone";
import type { Client } from "@/lib/types";

export default function ClientCard({ client }: { client: Client }) {
  return (
    <Link
      href={`/clients/${client.id}`}
      className="block bg-card p-4 text-charcoal transition hover:opacity-90"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl leading-tight">{client.name}</h3>
        <span className="text-xs uppercase tracking-wide text-charcoal/50">
          {client.preferred_language}
        </span>
      </div>
      {client.address && (
        <p className="mt-1 text-sm text-charcoal/70">
          {client.address}
          {client.city ? `, ${client.city}` : ""}
        </p>
      )}
      <p className="text-sm text-charcoal/70">{formatPhone(client.phone)}</p>
    </Link>
  );
}
