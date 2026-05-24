-- Demo seed data for local development
-- Run after creating a user via signup (replace USER_ID with auth.users id)

-- Example usage:
-- 1. Sign up at /signup and complete onboarding, OR
-- 2. Replace the placeholders below and run in Supabase SQL editor

/*
INSERT INTO businesses (name, slug, business_type, timezone)
VALUES ('Demo Salon', 'demo-salon', 'salon', 'UTC')
ON CONFLICT (slug) DO NOTHING;

-- After signup, link owner:
INSERT INTO business_members (business_id, user_id, display_name, email, role, is_bookable)
SELECT b.id, 'YOUR_USER_ID'::uuid, 'Demo Owner', 'owner@demo.com', 'owner', true
FROM businesses b WHERE b.slug = 'demo-salon'
ON CONFLICT DO NOTHING;

INSERT INTO services (business_id, name, duration_minutes, price_cents, sort_order) 
SELECT b.id, 'Haircut', 30, 2500, 0 FROM businesses b WHERE b.slug = 'demo-salon'
UNION ALL
SELECT b.id, 'Color Treatment', 90, 8500, 1 FROM businesses b WHERE b.slug = 'demo-salon';

INSERT INTO staff_availability (staff_member_id, day_of_week, start_time, end_time)
SELECT bm.id, d.day, '09:00', '17:00'
FROM business_members bm
JOIN businesses b ON b.id = bm.business_id
CROSS JOIN (VALUES (1),(2),(3),(4),(5)) AS d(day)
WHERE b.slug = 'demo-salon' AND bm.role = 'owner';
*/
