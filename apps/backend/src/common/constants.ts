/**
 * Application-wide constants for single-tenant mode.
 *
 * DEFAULT_ORG_ID is the legacy Organization UUID for this single-tenant
 * deployment. It is used as the HKDF context/info value for credential
 * encryption (Zoom, SMS, Email, Moyasar) so changing it would invalidate all
 * existing ciphertext.
 */
export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Single-tenant cryptographic/context identifier.
 *
 * Alias of DEFAULT_ORG_ID for internal services that need a stable deployment
 * context but should not imply runtime tenant selection.
 */
export const SINGLE_TENANT_CONTEXT_ID = DEFAULT_ORG_ID;

/**
 * Constant key for the single OrganizationPaymentConfig row. Single-tenant: the
 * table holds exactly one row, enforced by a UNIQUE constraint on this column,
 * so reads use findUnique({ singletonKey }) and writes use upsert — no race.
 */
export const PAYMENT_CONFIG_SINGLETON_KEY = 'singleton' as const;

// ─── CLS keys ──────────────────────────────────────────────────────────────
// These are carried in nestjs-cls async-local-storage to propagate context
// without threading it through every function call.

/** Key carrying the resolved tenant context (organizationId, userId, role). */
export const TENANT_CLS_KEY = 'tenant' as const;

/**
 * Key marking the current CLS context as "system" — used by webhooks, cron
 * jobs, and other non-HTTP entry points that run outside a tenant request.
 * When set to `true`, Prisma queries bypass tenant scoping.
 */
export const SYSTEM_CONTEXT_CLS_KEY = 'systemContext' as const;

/**
 * Key marking the current CLS context as super-admin. When set to `true`,
 * cross-tenant Prisma reads are permitted (e.g. refresh-token rotation, cron
 * jobs that span all data).
 */
export const SUPER_ADMIN_CONTEXT_CLS_KEY = 'superAdminContext' as const;

/**
 * Key carrying a pinned Prisma TransactionClient. When set, the PrismaService
 * proxy routes all model accessors through this transaction so every query in
 * the request reuses the same connection.
 */
export const REQUEST_TX_CLS_KEY = 'request_tx';
