-- Backfill: one Membership per existing User under the default organization.
-- Maps User.role (UserRole enum) -> MembershipRole enum. Unknown roles default to RECEPTIONIST.
-- CLIENT users are excluded — they are website clients, not clinic staff, and
-- must not receive a staff membership under the default org.
-- Idempotent: ON CONFLICT DO NOTHING uses the (userId, organizationId) unique.

INSERT INTO "Membership" (id, "userId", "organizationId", role, "isActive", "acceptedAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  u.id,
  '00000000-0000-0000-0000-000000000001',
  CASE u.role::text
    WHEN 'SUPER_ADMIN'  THEN 'OWNER'::"MembershipRole"
    WHEN 'ADMIN'        THEN 'ADMIN'::"MembershipRole"
    WHEN 'RECEPTIONIST' THEN 'RECEPTIONIST'::"MembershipRole"
    WHEN 'ACCOUNTANT'   THEN 'ACCOUNTANT'::"MembershipRole"
    WHEN 'EMPLOYEE'     THEN 'EMPLOYEE'::"MembershipRole"
    ELSE 'RECEPTIONIST'::"MembershipRole"
  END,
  TRUE,
  u."createdAt",
  NOW(),
  NOW()
FROM "User" u
WHERE u.role::text <> 'CLIENT'
ON CONFLICT ("userId", "organizationId") DO NOTHING;
