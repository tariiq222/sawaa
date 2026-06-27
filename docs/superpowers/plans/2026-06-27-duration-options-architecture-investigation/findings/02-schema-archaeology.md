# 02 — Schema Archaeology: Pricing Tables Timeline

**Base commit:** `71f0214c` (HEAD of Task 1, "spike analysis 2026-06-23")
**Investigation date:** 2026-06-27
**Scope:** Prisma migration history + current schema for `ServiceBookingConfig`, `ServiceDurationOption`, `EmployeeServiceOption`, and `EmployeeService.useCustomPricing`.

---

## 1. Migration folder format observation

The brief assumed format `YYYYMMDDHHMMSS_xxx`. The actual format in this repo is `YYYYMMDDHHMMSS_description` (14-digit timestamp prefix + snake_case suffix). The timestamp's timezone is the local time of the developer who ran `prisma migrate dev`. The migration dir for this investigation is the standard `apps/backend/prisma/migrations/`.

> **Format note recorded per task instructions:** folder name format is `YYYYMMDDHHMMSS_description`. All "Date" entries in the table below are the leading 8 characters of the folder name (Asia/Riyadh local time of the author, not UTC). Migrations are mostly authored in bursts on the same day, so the **intra-day ordering matters** and is given by the full 14-digit timestamp.

## 2. Timeline

| Date (folder timestamp) | Table / Field | Change | Implication |
|---|---|---|---|
| **2026-05-14 10:00:00** — `20260514100000_baseline` | `ServiceBookingConfig` | **CREATED.** Columns: `id`, `serviceId`, `bookingType` (enum `ServiceBookingMode`), `price` Decimal(12,2) default 0, `durationMins` int default 30, `isActive`, `createdAt`, `updatedAt`. PK only, no UNIQUE. | One row per service+bookingType. BookingType enum predates DeliveryType split. Price and duration are a single tuple per (service, mode) at the service level. |
| **2026-05-14 10:00:00** — `20260514100000_baseline` | `ServiceDurationOption` | **CREATED.** Columns: `id`, `serviceId`, `bookingType` (nullable), `label`, `labelAr`, `durationMins`, `price` Decimal(12,2), `currency` default 'SAR', `isDefault` default false, `sortOrder`, `isActive`. PK only, **no UNIQUE on (serviceId, durationMins) at the time**; comment in the baseline says multiple rows per (service, duration) are allowed. | This is the "variable-duration" table. Allows multiple duration variants per service (e.g., 30-min / 60-min / 90-min sessions) under the same bookingType. |
| **2026-05-14 10:00:00** — `20260514100000_baseline` | `EmployeeServiceOption` | **CREATED.** Columns: `id`, `employeeServiceId`, `durationOptionId`, `priceOverride` (nullable), `durationOverride` (nullable), `isActive`. PK only. | Per-practitioner override of a specific `ServiceDurationOption`. The nullable overrides were always designed as a "fall back to the parent" mechanism. |
| **2026-05-14 10:00:00** — `20260514100000_baseline` | `EmployeeServiceOption` | **Adds UNIQUE index** `EmployeeServiceOption_employeeServiceId_durationOptionId_key` on `(employeeServiceId, durationOptionId)` (line 1708 of `migration.sql`). | Establishes the "one override per (practitioner, duration)" rule at the DB level **from the very first migration**. (Correction note: an earlier draft attributed this UNIQUE to `20260515064300_add_token_version_and_unique_constraints`, which has zero `EmployeeServiceOption` references, and to `20260520134448_add_delivery_type_and_bundles`, whose only mention of this index is inside a `/* ... */` commented-out block at lines 211–219 — neither migration actually creates the index.) |
| **2026-05-20 13:44:48** — `20260520134448_add_delivery_type_and_bundles` | All three tables | **Adds `deliveryType DeliveryType` column (nullable)**. Backfill guide inside the migration file (lines 142–177) shows expected data: `ONLINE` if old `bookingType=ONLINE`, else `IN_PERSON`. | Splits delivery channel from booking mode. Adds `DeliveryType` enum (`IN_PERSON`, `ONLINE`). The nullable column is the *transition state*. |
| **2026-05-20 15:00:00** — `20260520150000_finalize_delivery_type_transition` | `ServiceBookingConfig` | **Drops** `bookingType` column + `ServiceBookingConfig_serviceId_bookingType_key` UNIQUE index. **Adds** UNIQUE index `ServiceBookingConfig_serviceId_deliveryType_key` on `(serviceId, deliveryType)`. Sets `deliveryType` NOT NULL. | Locks the invariant: one config per (service, delivery channel). This is the **new primary key of the table** for application purposes. |
| **2026-05-20 15:00:00** — `20260520150000_finalize_delivery_type_transition` | `ServiceDurationOption` | **Drops** `bookingType` column + `ServiceDurationOption_serviceId_bookingType_idx` index. **Adds** non-unique index `ServiceDurationOption_serviceId_deliveryType_idx`. Sets `deliveryType` NOT NULL. **Adds partial unique index** `ServiceDurationOption_one_default_active_delivery_idx` on `(serviceId, deliveryType) WHERE isDefault=true AND isActive=true` (gated by a DO block that skips if historical duplicates exist). | Confirms design intent in schema: multiple durations per (service, delivery) — only the "default" slot is unique. Migration explicitly **skips creating the partial index** in production if duplicate active defaults exist. **Task 1's "no unique guard on (serviceId, deliveryType, durationMins)" finding is consistent with this history**: multiple non-default rows are intentionally allowed. |
| **2026-05-20 15:00:00** — `20260520150000_finalize_delivery_type_transition` | `EmployeeServiceOption` | **Drops** the old UNIQUE index `EmployeeServiceOption_employeeServiceId_durationOptionId_key`. **Adds** UNIQUE index `EmployeeServiceOption_employee_duration_delivery_key` on `(employeeServiceId, durationOptionId, deliveryType)`. Sets `deliveryType` NOT NULL. | Re-keys the override uniqueness on the delivery channel. The old index would have allowed the same practitioner to override one duration option under two different deliveryTypes — now impossible. |
| **2026-06-07 19:11:00** — `20260606191100_phase4_domain_check_constraints` | All three tables | Adds CHECK constraints: `*_price_nonnegative_chk`, `*_durationMins_positive_chk` (or `durationOverride_positive_chk`). | Defensive data-quality guard. Confirms price is a non-negative decimal and duration is a positive integer. No structural change. |
| **2026-06-19 00:00:00** — `20260619000000_employee_duration_options` | `ServiceDurationOption` | **Adds nullable `employeeServiceId` column** + index. | The big pivot. A `ServiceDurationOption` can now be **owned by a specific practitioner** (non-null `employeeServiceId`) or remain a service-level default (NULL). This is the foundation for per-practitioner pricing. The migration comment makes it explicit: "NULL = service-level default; non-null = owned by that EmployeeService." |
| **2026-06-20 00:00:00** — `20260620000000_add_employee_service_disabled_delivery_types` | `EmployeeService` | **Adds `disabledDeliveryTypes DeliveryType[] @default([])`** to `EmployeeService`. | Practitioner can opt out of delivery types their service supports. Pairs with `useCustomPricing` (added next migration) to form the practitioner's full "which durations I offer" gate. |
| **2026-06-20 01:00:00** — `20260620010000_add_employee_service_use_custom_pricing` | `EmployeeService.useCustomPricing` | **Adds `useCustomPricing Boolean @default(false)`**. The migration comment is explicit: *"When true, only `ServiceDurationOption` rows owned by this practitioner (`employeeServiceId = link.id`) are offered for booking. Types with no owned options are hidden entirely."* | The on/off switch for the per-practitioner pricing model. When true, the resolver reads from `EmployeeServiceOption` joined to `ServiceDurationOption WHERE employeeServiceId = link.id`; when false, the service-level options are used. |

## 3. Current role verdict (per table)

### `ServiceBookingConfig` — **Primary source of truth, but only for the "does this service offer this delivery channel at all + base price" question**
- After the delivery-type transition, each row is uniquely keyed by `(serviceId, deliveryType)`. It is the gate that says "this service supports IN_PERSON" (or ONLINE). Its `price` and `durationMins` are the **service-level defaults** used when no duration options exist.
- Per `PriceResolverService` in INHERIT mode (per Task 1 brief), it is consulted as the **fallback step 3** when neither an employee override nor a duration option price resolves. It is *not* the user-facing price source for services that have duration options.
- **Verdict:** **Primary source of truth for "is this delivery channel available" and "base price if no other tier exists"; fallback for price in INHERIT mode when no duration option is selected.**

### `ServiceDurationOption` — **Primary source of truth for the variable-duration menu**
- A service can have multiple `ServiceDurationOption` rows per delivery type (e.g., 30 / 60 / 90 min). The unique key is `(serviceId, deliveryType, isDefault=true & isActive=true)` — i.e., only the default slot is unique.
- Since migration `20260619000000_employee_duration_options`, a row can optionally belong to a specific `EmployeeService` via the nullable `employeeServiceId` column. This is the table the dashboard "duration options" UI writes to.
- **Verdict:** **Primary source of truth for the customer-facing duration/price menu.** When `EmployeeService.useCustomPricing = true`, the resolver filters this table by `employeeServiceId = link.id` to produce the practitioner's bespoke menu.

### `EmployeeServiceOption` — **Per-practitioner override layer; legacy schema, re-validated by current resolver**
- Was always designed as a nullable-override table (priceOverride / durationOverride are nullable, "fall back to duration option" semantics baked into the original `20260514100000_baseline` model comment).
- After the delivery-type transition its UNIQUE key is `(employeeServiceId, durationOptionId, deliveryType)` — a practitioner has at most one override per (duration, channel).
- Per the schema comment in `organization.prisma` line 216: *"Resolution order (PriceResolverService): (1) priceOverride → (2) ServiceDurationOption.price → (3) Service.price"*. This is INHERIT-mode step 1.
- **Verdict:** **Primary source of truth for the per-practitioner price override in INHERIT mode.** Not a legacy vestige — it is the most-specific lookup in the resolver chain. However, the **same role can now be achieved** by the newer `ServiceDurationOption.employeeServiceId` ownership pattern (migration `20260619000000`): a duration option owned by a practitioner implicitly sets the price and duration. So `EmployeeServiceOption` is **active but partially shadowed by the newer ownership pattern**, and any design that consolidates pricing should consider whether both should coexist or whether `EmployeeServiceOption` is the next layer to fold in.

### `EmployeeService.useCustomPricing` — **Mode switch**
- Added on 2026-06-20 to gate whether the resolver consults employee-owned `ServiceDurationOption` rows or the service-level ones. It is the **boolean that flips the resolution strategy**, not a data store.

## 4. Gap analysis (what the migration history cannot tell us)

1. **Seed data timeline** — the migrations only tell us the **schema**; the **runtime data shape** is decided by `prisma/seed.ts` and any prod backfills. We did not parse the seed file in this task.
2. **`PriceResolverService` actual code** — its real branching and DB query patterns (INHERIT mode step 1/2/3, etc.) are referenced in the schema comment and Task 1 brief but were not re-read in this task (Task 1 already covered runtime).
3. **Custom-pricing endpoint `delete` asymmetry** — flagged in MEMORY (`pricing-booking-integrity-audit-2026-06-20.md`) as a "deferred" cleanup item. Not visible in the migration history; it's an endpoint issue, not a schema one. Worth flagging for Task 7.

## 5. Conclusion for downstream tasks (6 & 7)

- All three pricing tables are **live and load-bearing**. None is a "legacy vestige" in the strict sense.
- `ServiceDurationOption` is the **operationally primary table** (the dashboard writes here, the customer sees these prices, the resolver reads here first when no override exists).
- `ServiceBookingConfig` is the **delivery-channel gate and service-level fallback**.
- `EmployeeServiceOption` is the **per-practitioner override layer** and is still the first lookup in the resolver chain; the newer `ServiceDurationOption.employeeServiceId` ownership pattern is an alternative path to the same outcome (practitioner-specific menu) and the two patterns may be candidates for consolidation in a future design.
- `useCustomPricing` is the **switch** that decides which path the resolver takes. A schema change that touches it must remain backward-compatible (`default false` preserves existing behavior).
- The migration history confirms Task 1's verdict: the schema has **no UNIQUE guard on `(serviceId, deliveryType, durationMins)`** for `ServiceDurationOption`. The only uniqueness on that table is on the default flag (partial unique index on `isDefault=true AND isActive=true`). Multiple non-default rows for the same (service, delivery, duration) value are allowed by the DB; any de-duplication is application-layer.
