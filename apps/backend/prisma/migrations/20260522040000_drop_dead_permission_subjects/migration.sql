-- Drop orphan Permission rows for subjects removed from the catalog.
-- Subscription/Plan/Billing were multi-tenant SaaS leftovers and have no
-- corresponding routes, handlers, or CASL rules in the single-tenant app.
DELETE FROM "Permission" WHERE subject IN ('Subscription', 'Plan', 'Billing');
