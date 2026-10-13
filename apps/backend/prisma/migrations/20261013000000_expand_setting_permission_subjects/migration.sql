-- Setting subject split: data migration.
--
-- The CASL subject "Setting" was split into "Content", "PersonalData",
-- "ProviderConfig" and "Refund" (see SETTING_SPLIT_SUBJECTS in
-- packages/shared/constants/permissions-catalog.ts). To keep every existing
-- role's effective access unchanged, each stored "Setting" permission row is
-- copied onto the four new subjects with the same action and role.
--
-- Additive-only and idempotent: it only inserts rows, never updates or deletes
-- ("Setting" rows stay), and ON CONFLICT DO NOTHING makes re-runs a no-op.
-- See docs/operations/migration-charter.md.
INSERT INTO "Permission" ("id", "customRoleId", "action", "subject", "createdAt")
SELECT gen_random_uuid()::text, p."customRoleId", p."action", s."subject", CURRENT_TIMESTAMP
FROM "Permission" p
CROSS JOIN (VALUES ('Content'), ('PersonalData'), ('ProviderConfig'), ('Refund')) AS s("subject")
WHERE p."subject" = 'Setting'
ON CONFLICT ("customRoleId", "action", "subject") DO NOTHING;
