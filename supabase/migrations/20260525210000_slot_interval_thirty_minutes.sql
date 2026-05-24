-- Default booking slots to 30 minutes (half hour)

ALTER TABLE businesses ALTER COLUMN settings SET DEFAULT '{
  "slot_interval_minutes": 30,
  "min_notice_hours": 2,
  "max_advance_days": 60,
  "auto_confirm": true
}'::jsonb;

UPDATE businesses
SET settings = jsonb_set(
  settings,
  '{slot_interval_minutes}',
  '30'::jsonb
)
WHERE (settings->>'slot_interval_minutes')::int IN (15, 60);
