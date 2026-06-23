-- Render OS — seed data
-- Run AFTER schema.sql, once, in the Supabase SQL editor.
-- Replace <your-user-id> with the UUID from Authentication → Users.

-- Default service catalog for Render Exteriors
-- Prices in cents (CAD). Adjust to your actual pricing.
insert into service_catalog (owner_id, name_en, name_zh, default_price, description_en, description_zh)
values
  ('<your-user-id>', 'Roof Wash',          '屋顶清洗',   45000, '2-year warranty included', '含两年保修'),
  ('<your-user-id>', 'House Wash',         '外墙清洗',   32500, 'Soft-wash exterior',        '软水外墙清洗'),
  ('<your-user-id>', 'Driveway/Concrete',  '车道/混凝土', 20000, 'Pressure wash',             '高压冲洗'),
  ('<your-user-id>', 'Gutters',            '排水槽清洁',  15000, 'Clean & flush gutters',     '清洁并冲洗排水槽'),
  ('<your-user-id>', 'Windows',            '窗户清洁',   12500, 'Interior + exterior',        '内外清洁')
on conflict do nothing;
