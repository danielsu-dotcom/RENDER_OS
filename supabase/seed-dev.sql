-- Render OS — developer seed with time-travel
-- Run AFTER schema.sql + seed.sql (service catalog must exist).
-- Replace <your-user-id> with your auth UUID (Authentication → Users in Supabase Studio).
--
-- Time-travel: timestamps are set relative to NOW() so automation rules fire
-- correctly against real time windows. Run on any day — the data ages properly.
--
-- To reset: DELETE FROM messages; DELETE FROM invoices; DELETE FROM jobs;
--           DELETE FROM quotes; DELETE FROM clients; DELETE FROM automation_log;
--           (service_catalog rows survive — delete manually if needed)

do $$
declare
  uid          uuid := '<your-user-id>';

  -- clients
  c1           uuid := gen_random_uuid();
  c2           uuid := gen_random_uuid();
  c3           uuid := gen_random_uuid();
  c4           uuid := gen_random_uuid();

  -- quotes
  q_draft      uuid := gen_random_uuid();
  q_sent       uuid := gen_random_uuid();
  q_accepted   uuid := gen_random_uuid();
  q_expired    uuid := gen_random_uuid();

  -- jobs
  j1           uuid := gen_random_uuid();  -- completed, with warranty, ~12 months old
  j2           uuid := gen_random_uuid();  -- completed, ~11 months old (due for rebooking)

  -- invoices
  inv1         uuid := gen_random_uuid();  -- unpaid (from accepted quote)

  -- catalog items (re-use what seed.sql inserted)
  cat_roof     uuid;
  cat_house    uuid;
  cat_driveway uuid;

begin
  -- ── Resolve catalog item IDs ──────────────────────────────────────────────
  select id into cat_roof     from service_catalog where owner_id = uid and name_en = 'Roof Wash'    limit 1;
  select id into cat_house    from service_catalog where owner_id = uid and name_en = 'House Wash'   limit 1;
  select id into cat_driveway from service_catalog where owner_id = uid and name_en = 'Driveway/Concrete' limit 1;

  -- ── Clients ───────────────────────────────────────────────────────────────
  insert into clients (id, owner_id, name, phone, email, address, city, preferred_language, sms_consent, notes, created_at)
  values
    (c1, uid, 'Sarah Chen',    '+16045550101', 'sarah@example.com',  '1234 Maple St',    'Vancouver',  'zh', true,  null, now() - interval '18 months'),
    (c2, uid, 'James Hooper',  '+16045550102', 'james@example.com',  '56 Oak Ave',       'Burnaby',    'en', true,  '[2026-01-10] Prefers morning slots.', now() - interval '14 months'),
    (c3, uid, 'Linda Tran',    '+16045550103', null,                 '789 Cedar Dr',     'Coquitlam',  'en', true,  null, now() - interval '6 months'),
    (c4, uid, 'Michael Wang',  '+16045550104', 'mwang@example.com',  '321 Birch Cres',   'Richmond',   'zh', false, null, now() - interval '2 months');

  -- ── Quotes ────────────────────────────────────────────────────────────────

  -- Draft (created today, not yet sent)
  insert into quotes (id, owner_id, client_id, status, line_items, subtotal, gst, total, expires_at, created_at)
  values (
    q_draft, uid, c4, 'draft',
    jsonb_build_array(
      jsonb_build_object('service_id', cat_house, 'name_en', 'House Wash', 'name_zh', '外墙清洗', 'price', 32500, 'qty', 1)
    ),
    32500, 1625, 34125,
    now() + interval '30 days',
    now() - interval '1 hour'
  );

  -- Sent 3 days ago (within D2 follow-up window) — client c3
  insert into quotes (id, owner_id, client_id, status, line_items, subtotal, gst, total, sent_at, expires_at, created_at)
  values (
    q_sent, uid, c3, 'sent',
    jsonb_build_array(
      jsonb_build_object('service_id', cat_roof,     'name_en', 'Roof Wash',         'name_zh', '屋顶清洗',   'price', 45000, 'qty', 1),
      jsonb_build_object('service_id', cat_driveway, 'name_en', 'Driveway/Concrete', 'name_zh', '车道/混凝土', 'price', 20000, 'qty', 1)
    ),
    65000, 3250, 68250,
    now() - interval '3 days',
    now() + interval '27 days',
    now() - interval '3 days'
  );

  -- Accepted — client c2 (will get an invoice)
  insert into quotes (id, owner_id, client_id, status, line_items, subtotal, gst, total, sent_at, accepted_at, expires_at, created_at)
  values (
    q_accepted, uid, c2, 'accepted',
    jsonb_build_array(
      jsonb_build_object('service_id', cat_house,    'name_en', 'House Wash', 'name_zh', '外墙清洗', 'price', 32500, 'qty', 1),
      jsonb_build_object('service_id', cat_driveway, 'name_en', 'Driveway/Concrete', 'name_zh', '车道/混凝土', 'price', 20000, 'qty', 1)
    ),
    52500, 2625, 55125,
    now() - interval '10 days',
    now() - interval '8 days',
    now() + interval '20 days',
    now() - interval '10 days'
  );

  -- Expired — client c1 (sent 45 days ago, no response)
  insert into quotes (id, owner_id, client_id, status, line_items, subtotal, gst, total, sent_at, expires_at, created_at)
  values (
    q_expired, uid, c1, 'expired',
    jsonb_build_array(
      jsonb_build_object('service_id', cat_roof, 'name_en', 'Roof Wash', 'name_zh', '屋顶清洗', 'price', 45000, 'qty', 1)
    ),
    45000, 2250, 47250,
    now() - interval '45 days',
    now() - interval '15 days',
    now() - interval '45 days'
  );

  -- ── Invoice (unpaid, from accepted quote) ─────────────────────────────────
  insert into invoices (id, owner_id, quote_id, client_id, status, issued_at, created_at)
  values (inv1, uid, q_accepted, c2, 'unpaid', now() - interval '8 days', now() - interval '8 days');

  -- ── Jobs ─────────────────────────────────────────────────────────────────

  -- Job completed ~12 months ago, with 24-month warranty (warranty_inspection due)
  insert into jobs (id, owner_id, client_id, quote_id, services, scheduled_date, completed_at, warranty_months, warranty_expires_at, created_at)
  values (
    j1, uid, c1, null,
    jsonb_build_array(
      jsonb_build_object('service_id', cat_roof, 'name_en', 'Roof Wash', 'name_zh', '屋顶清洗', 'price', 45000, 'qty', 1)
    ),
    (now() - interval '12 months')::date,
    now() - interval '12 months',
    24,
    now() + interval '12 months',
    now() - interval '12 months'
  );

  -- Job completed ~11 months ago, no warranty (rebooking due)
  insert into jobs (id, owner_id, client_id, quote_id, services, scheduled_date, completed_at, warranty_months, warranty_expires_at, created_at)
  values (
    j2, uid, c2, null,
    jsonb_build_array(
      jsonb_build_object('service_id', cat_house, 'name_en', 'House Wash', 'name_zh', '外墙清洗', 'price', 32500, 'qty', 1)
    ),
    (now() - interval '11 months')::date,
    now() - interval '11 months',
    null,
    null,
    now() - interval '11 months'
  );

  -- ── Sample SMS messages ───────────────────────────────────────────────────
  insert into messages (owner_id, client_id, direction, channel, body, template_key, language, status, created_at)
  values
    -- Outbound: quote sent notification to c3
    (uid, c3, 'outbound', 'sms',
     'Hi Linda! Your Render Exteriors quote is ready — tap the link to review and accept: https://renderexteriors.ca/q/demo',
     'quote_sent', 'en', 'delivered', now() - interval '3 days'),
    -- Inbound: client replied
    (uid, c3, 'inbound', 'sms',
     'Thanks! I''ll take a look.',
     null, null, 'delivered', now() - interval '3 days' + interval '5 minutes'),
    -- Outbound: quote follow-up to c1 (automated)
    (uid, c1, 'outbound', 'sms',
     '您好 Sarah！您的 Render Exteriors 报价仍然有效。如有任何问题，请随时联系我们。',
     'quote_followup_d7', 'zh', 'delivered', now() - interval '38 days');

end $$;
