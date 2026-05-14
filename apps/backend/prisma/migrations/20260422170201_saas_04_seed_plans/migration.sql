-- SaaS-04 — Seed the three canonical plan tiers.
-- Prices in SAR. Annual ≈ 17% discount vs 12× monthly.
-- Overage rates (SAR): booking=0.50, client=0.10, storage=5/GB.
-- BRANCHES / EMPLOYEES are hard-capped (no overage; upgrade required).
-- -1 = unlimited.
-- Idempotent via ON CONFLICT: reseeding is safe.

INSERT INTO "Plan" (id, slug, "nameAr", "nameEn", "priceMonthly", "priceAnnual", currency, limits, "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000p1001', 'BASIC',      'الأساسية',    'Basic',         299,  2999, 'SAR',
    '{"maxBranches":1,"maxEmployees":5,"maxBookingsPerMonth":500,"maxClients":1000,"maxStorageMB":5120,"overageRateBookings":0.5,"overageRateClients":0.1,"overageRateStorageGB":5,"websiteEnabled":false,"customDomainEnabled":false,"chatbotEnabled":false,"zatcaEnabled":true,"ratingsEnabled":true}'::jsonb,
    true, 10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000p1002', 'PRO',        'الاحترافية',  'Professional',  799,  7999, 'SAR',
    '{"maxBranches":3,"maxEmployees":15,"maxBookingsPerMonth":2000,"maxClients":5000,"maxStorageMB":25600,"overageRateBookings":0.5,"overageRateClients":0.1,"overageRateStorageGB":5,"websiteEnabled":true,"customDomainEnabled":false,"chatbotEnabled":true,"zatcaEnabled":true,"ratingsEnabled":true}'::jsonb,
    true, 20, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000p1003', 'ENTERPRISE', 'المؤسسية',    'Enterprise',   1999, 19999, 'SAR',
    '{"maxBranches":-1,"maxEmployees":-1,"maxBookingsPerMonth":-1,"maxClients":-1,"maxStorageMB":102400,"overageRateBookings":0,"overageRateClients":0,"overageRateStorageGB":5,"websiteEnabled":true,"customDomainEnabled":true,"chatbotEnabled":true,"zatcaEnabled":true,"ratingsEnabled":true}'::jsonb,
    true, 30, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
