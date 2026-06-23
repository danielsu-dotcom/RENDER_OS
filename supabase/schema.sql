-- Render OS — Supabase schema (P0.1)
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- Conventions enforced here:
--   • Multi-tenancy: every table has owner_id -> auth.users, RLS locked to it.
--   • Money is integer CENTS, never floats.
--   • Phone numbers are E.164 (+1...), enforced by CHECK.
--   • Quote status is a state machine — transition only via set_quote_status().
--   • automation_log makes cron sends idempotent (unique guards below).

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists clients (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  name               text not null,
  phone              text not null check (phone ~ '^\+[1-9]\d{1,14}$'),
  email              text,
  address            text,
  city               text,
  preferred_language text not null default 'en' check (preferred_language in ('en','zh')),
  sms_consent        boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now()
);

create table if not exists service_catalog (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  name_en        text not null,
  name_zh        text not null,
  default_price  integer not null check (default_price >= 0), -- cents
  description_en text,
  description_zh text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists quotes (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  client_id    uuid not null references clients (id) on delete cascade,
  status       text not null default 'draft'
               check (status in ('draft','sent','accepted','declined','expired')),
  -- [{ service_id, name_en, name_zh, price (cents), qty }]
  line_items   jsonb not null default '[]'::jsonb,
  subtotal     integer not null default 0, -- cents
  gst          integer not null default 0, -- cents
  total        integer not null default 0, -- cents
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  sent_at      timestamptz,
  accepted_at  timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists jobs (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users (id) on delete cascade,
  client_id           uuid not null references clients (id) on delete cascade,
  quote_id            uuid references quotes (id) on delete set null,
  services            jsonb not null default '[]'::jsonb,
  scheduled_date      date,
  completed_at        timestamptz,
  warranty_months     integer check (warranty_months is null or warranty_months >= 0),
  warranty_expires_at timestamptz, -- computed by trigger on completion
  created_at          timestamptz not null default now()
);

create table if not exists invoices (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  quote_id   uuid not null references quotes (id) on delete cascade,
  client_id  uuid not null references clients (id) on delete cascade,
  status     text not null default 'unpaid' check (status in ('unpaid','paid')),
  issued_at  timestamptz not null default now(),
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  client_id    uuid not null references clients (id) on delete cascade,
  direction    text not null check (direction in ('outbound','inbound')),
  channel      text not null default 'sms' check (channel in ('sms')),
  body         text not null,
  template_key text,
  language     text check (language in ('en','zh')),
  status       text not null default 'queued'
               check (status in ('queued','sent','delivered','failed')),
  twilio_sid   text,
  created_at   timestamptz not null default now()
);

create table if not exists automation_log (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  type       text not null check (type in (
               'quote_followup_d2','quote_followup_d7','rebooking',
               'review_request','warranty_inspection')),
  client_id  uuid references clients (id) on delete cascade,
  quote_id   uuid references quotes (id) on delete cascade,
  job_id     uuid references jobs (id) on delete cascade,
  fired_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists clients_owner_idx        on clients (owner_id);
create index if not exists service_catalog_owner_idx on service_catalog (owner_id);
create index if not exists quotes_owner_idx          on quotes (owner_id);
create index if not exists quotes_client_idx         on quotes (client_id);
create index if not exists quotes_status_idx         on quotes (status);
create index if not exists jobs_owner_idx            on jobs (owner_id);
create index if not exists jobs_client_idx           on jobs (client_id);
create index if not exists invoices_owner_idx        on invoices (owner_id);
create index if not exists messages_owner_idx        on messages (owner_id);
create index if not exists messages_client_idx       on messages (client_id);
create index if not exists automation_log_owner_idx  on automation_log (owner_id);

-- Idempotency: a given automation type fires at most once per quote / per job.
create unique index if not exists automation_once_per_quote
  on automation_log (type, quote_id) where quote_id is not null;
create unique index if not exists automation_once_per_job
  on automation_log (type, job_id) where job_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Quote status state machine — the ONLY legal way to change quotes.status.
-- Legal: draft→sent, sent→accepted, sent→declined, sent→expired.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function set_quote_status(p_quote_id uuid, p_new_status text)
returns quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes;
  v_legal boolean;
begin
  select * into v_quote from quotes
   where id = p_quote_id and owner_id = auth.uid()
   for update;

  if not found then
    raise exception 'Quote % not found', p_quote_id using errcode = 'no_data_found';
  end if;

  v_legal := (v_quote.status, p_new_status) in (
    ('draft','sent'), ('sent','accepted'), ('sent','declined'), ('sent','expired')
  );

  if not v_legal then
    raise exception 'Illegal quote transition % -> %', v_quote.status, p_new_status
      using errcode = 'check_violation';
  end if;

  update quotes
     set status      = p_new_status,
         sent_at     = case when p_new_status = 'sent'     then now() else sent_at end,
         accepted_at = case when p_new_status = 'accepted' then now() else accepted_at end
   where id = p_quote_id
   returning * into v_quote;

  return v_quote;
end;
$$;

-- Defense in depth: block any direct UPDATE that changes status illegally,
-- so UI/PostgREST cannot bypass the state machine.
create or replace function enforce_quote_status_machine()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if (old.status, new.status) not in (
         ('draft','sent'),('sent','accepted'),('sent','declined'),('sent','expired')
       ) then
      raise exception 'Illegal quote transition % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_status_guard on quotes;
create trigger quotes_status_guard
  before update on quotes
  for each row execute function enforce_quote_status_machine();

-- ─────────────────────────────────────────────────────────────────────────────
-- Warranty: compute warranty_expires_at when a job is completed.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function compute_warranty_expiry()
returns trigger language plpgsql as $$
begin
  if new.completed_at is not null and new.warranty_months is not null then
    new.warranty_expires_at := new.completed_at + (new.warranty_months || ' months')::interval;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_warranty_compute on jobs;
create trigger jobs_warranty_compute
  before insert or update on jobs
  for each row execute function compute_warranty_expiry();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — every table locked to its owner.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'clients','service_catalog','quotes','jobs','invoices','messages','automation_log'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists owner_all on %I;', t);
    execute format($p$
      create policy owner_all on %I
        for all
        using (owner_id = auth.uid())
        with check (owner_id = auth.uid());
    $p$, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Public (token-based, no auth) access for the client-facing quote page.
-- The public_token IS the credential; these bypass RLS via SECURITY DEFINER
-- and expose only quote + minimal client fields.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function get_public_quote(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', q.id,
    'status', q.status,
    'line_items', q.line_items,
    'subtotal', q.subtotal,
    'gst', q.gst,
    'total', q.total,
    'expires_at', q.expires_at,
    'created_at', q.created_at,
    'client_name', c.name,
    'client_address', c.address,
    'client_city', c.city,
    'language', c.preferred_language
  )
  from quotes q
  join clients c on c.id = q.client_id
  where q.public_token = p_token;
$$;

create or replace function accept_public_quote(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  select status into v_status from quotes where public_token = p_token for update;
  if not found then
    raise exception 'Quote not found' using errcode = 'no_data_found';
  end if;
  -- Idempotent: already accepted is a no-op success.
  if v_status = 'accepted' then
    return 'accepted';
  end if;
  -- Trigger enforces that only sent->accepted is legal.
  update quotes
     set status = 'accepted', accepted_at = now()
   where public_token = p_token;
  return 'accepted';
end;
$$;

grant execute on function get_public_quote(text)    to anon, authenticated;
grant execute on function accept_public_quote(text)  to anon, authenticated;
