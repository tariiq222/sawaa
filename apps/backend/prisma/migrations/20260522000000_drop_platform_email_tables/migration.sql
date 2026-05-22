-- Drop platform-level email pipeline tables. Single-tenant deployment uses
-- the tenant-configured email provider exclusively (see EmailProviderFactory).

DROP TABLE IF EXISTS "PlatformMailDeliveryLog";
DROP TABLE IF EXISTS "PlatformEmailLog";
DROP TABLE IF EXISTS "PlatformEmailTemplate";

DROP TYPE IF EXISTS "PlatformEmailLogStatus";
