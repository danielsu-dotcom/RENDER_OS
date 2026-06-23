// Domain types — mirror supabase/schema.sql. Money fields are integer CENTS.

export type Locale = "en" | "zh";

export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired";

export type InvoiceStatus = "unpaid" | "paid";
export type MessageDirection = "outbound" | "inbound";
export type MessageStatus = "queued" | "sent" | "delivered" | "failed";
export type AutomationType =
  | "quote_followup_d2"
  | "quote_followup_d7"
  | "rebooking"
  | "review_request"
  | "warranty_inspection";

export interface LineItem {
  service_id: string | null;
  name_en: string;
  name_zh: string;
  price: number; // cents, per unit
  qty: number;
}

export interface Client {
  id: string;
  owner_id: string;
  name: string;
  phone: string; // E.164
  email: string | null;
  address: string | null;
  city: string | null;
  preferred_language: Locale;
  sms_consent: boolean;
  notes: string | null;
  created_at: string;
}

export interface ServiceCatalogItem {
  id: string;
  owner_id: string;
  name_en: string;
  name_zh: string;
  default_price: number; // cents
  description_en: string | null;
  description_zh: string | null;
  active: boolean;
  created_at: string;
}

export interface Quote {
  id: string;
  owner_id: string;
  client_id: string;
  status: QuoteStatus;
  line_items: LineItem[];
  subtotal: number; // cents
  gst: number; // cents
  total: number; // cents
  public_token: string;
  sent_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  owner_id: string;
  client_id: string;
  quote_id: string | null;
  services: LineItem[];
  scheduled_date: string | null;
  completed_at: string | null;
  warranty_months: number | null;
  warranty_expires_at: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  owner_id: string;
  quote_id: string;
  client_id: string;
  status: InvoiceStatus;
  issued_at: string;
  paid_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  owner_id: string;
  client_id: string;
  direction: MessageDirection;
  channel: "sms";
  body: string;
  template_key: string | null;
  language: Locale | null;
  status: MessageStatus;
  twilio_sid: string | null;
  created_at: string;
}

export interface AutomationLogEntry {
  id: string;
  owner_id: string;
  type: AutomationType;
  client_id: string | null;
  quote_id: string | null;
  job_id: string | null;
  fired_at: string;
}

/** Shape returned by the get_public_quote() RPC (client-facing quote page). */
export interface PublicQuote {
  id: string;
  status: QuoteStatus;
  line_items: LineItem[];
  subtotal: number;
  gst: number;
  total: number;
  expires_at: string | null;
  created_at: string;
  client_name: string;
  client_address: string | null;
  client_city: string | null;
  language: Locale;
}
