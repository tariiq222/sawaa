# 05 — Service Edit Flow Trace (Admin Side)

**Base commit:** `6460cccd` (HEAD of Task 4, "booking flow trace")
**Investigation date:** 2026-06-27
**Scope:** The dashboard's admin service-edit form at `/dashboard/services/[id]/edit`. What fires on Save, in what order, and which DB rows are created/updated/deleted. Per-handler duplication risk assessment for the three handlers invoked from the main submit (`UpdateServiceHandler`, `SetServiceBookingConfigsHandler`, and the image-upload helpers), plus the per-employee mutations that fire *independently* from the form (C5–C11 from Task 3).

Read with: Task 3 call map (UI → endpoint → handler), Task 2 schema archaeology (UNIQUE constraints, role of each table).

---

## 1. The page → form → submit chain

| Layer | File | Lines |
|---|---|---|
| Route (edit) | `apps/dashboard/app/(dashboard)/services/[id]/edit/page.tsx` | 7-13 |
| Page component | `apps/dashboard/components/features/services/service-form-page.tsx` | 61-336 (the `ServiceFormPage` function) |
| onSubmit binding | `service-form-page.tsx:202-205` (`form.handleSubmit(handleSubmit, …)`) |
| onSubmit body | `service-form-page.tsx:141-199` (`handleSubmit`) |
| Booking-types payload builder | `service-form-helpers.ts:7-55` (`buildPayload`, `buildBookingTypesPayload`, `saveBookingTypesApi`, `saveBookingTypesMutation`) |
| Draft merger (server → form) | `booking-types-editor.tsx:207-232` (`mergeDraftsFromServer`) |
| Duration-options payload builder | `booking-types-editor.tsx:61-83` (`buildDurationOptionsPayload`) |

The page is a Next.js App Router file that simply renders `<ServiceFormPage mode="edit" serviceId={params.id} />` (line 11). The full form is in `ServiceFormPage`; tabs (`basic`, `pricing`, `booking`, `employees`) are local state (`activeTab`, line 69). All tab mutations feed the same draft; the **only network calls** triggered by the form are inside `handleSubmit` (lines 141-199).

## 2. Mutations that fire on Save (in order)

`handleSubmit` runs three `await`s sequentially for the `isEdit` branch (lines 144-160):

| Order | Mutation | Endpoint | Handler | Purpose |
|---|---|---|---|---|
| 1 | `updateMut.mutateAsync({ id, ...buildPayload(data), price, durationMins })` (lines 146-151) | `PATCH /dashboard/organization/services/:id` | `UpdateServiceHandler` (`update-service.handler.ts:13-114`) | Update `Service` row + cache invalidation |
| 2 | `uploadServiceImage(service.id, pendingAvatarFile.current)` (lines 153-156) — only if a new image was selected in the basic-info tab (stored in `pendingAvatarFile.current`, set in `BasicInfoTab.onImageSelect` line 294) | `POST /dashboard/media/upload` → `GET /dashboard/media/:id/presigned-url` → `PATCH /dashboard/organization/services/:id {imageUrl}` | `UploadMedia` + `PresignUrl` + `UpdateServiceHandler` (third call to the same handler) | Replace the service avatar |
| 3 | `saveBookingTypesMutation(service.id, bookingTypes, bookingTypesMutation)` (line 159) — only if `bookingTypesDirty` is true (set in `handleBookingTypesChange` line 137 whenever the user touches the pricing tab) | `PUT /dashboard/organization/services/:id/booking-types` | `SetServiceBookingConfigsHandler` (`set-service-booking-configs.handler.ts:12-182`) | Replace `ServiceBookingConfig` + `ServiceDurationOption` + `ServiceAvailabilityWindow` for this service |

Notes on order:
- **Sequential, not parallel.** Each step uses `await` (lines 146, 153, 158-160). The image upload is not parallelized with the basic-info save.
- **The "Save" button does not touch employees.** Per-row toggles in the Employees tab fire *independently* on their own click (Task 3, rows C5–C11) and are saved to the server immediately; the main form submit only persists basic-info + booking-types. `pendingEmployeeIds`/`pendingActive` state is only relevant in `mode === "create"` (lines 179-188).
- **The pricing tab is a *batch* save.** All price/duration edits made in the pricing tab are kept in local React state (`bookingTypes`, line 92) until the main form Save fires the booking-types PUT (line 159). The "PricingTab" component itself does not POST — see Task 3 note 5a.

## 3. Payload shapes (the exact wire format)

### 3a. `updateMut` — `PATCH /dashboard/organization/services/:id`

Constructed by `buildPayload` (`service-form-helpers.ts:7-27`) and then *augmented* in `handleSubmit` (lines 146-151):

```ts
{
  nameEn: string,
  nameAr: string,
  descriptionEn: string | undefined,
  descriptionAr: string | undefined,
  categoryId: string | undefined,
  isActive: boolean,
  isHidden: boolean,
  hidePriceOnBooking: boolean,
  hideDurationOnBooking: boolean,
  iconName: string | null,
  iconBgColor: string | null,
  imageUrl: string | null,            // explicitly dropped if it's a "blob:" URL — replaced later by step 2
  bufferMinutes: number,
  depositEnabled: boolean,
  depositAmount: number | undefined,  // in halalas, only if depositEnabled
  minLeadMinutes: number | null,
  maxAdvanceDays: number | null,
  // Added in handleSubmit after buildPayload:
  price: number | undefined,          // halalas, the FIRST enabled booking-type's price
  durationMins: number | undefined,   // the FIRST enabled booking-type's duration
}
```

The "first enabled" `price`/`durationMins` is taken from `bookingTypes.find((bt) => bt.enabled)` (line 145). If no booking type is enabled, both are `undefined` and the backend leaves `Service.price`/`Service.durationMins` untouched (`update-service.handler.ts:77-78` does `dto.price` directly — passing `undefined` is a no-op for Prisma).

### 3b. `uploadServiceImage` — three requests in sequence

From `lib/api/services.ts:160-175`:

1. `POST /dashboard/media/upload` (FormData with `file`) → returns `{ id, storageKey }`.
2. `GET /dashboard/media/:id/presigned-url?expirySeconds=900` → returns `{ url }`.
3. `PATCH /dashboard/organization/services/:serviceId { imageUrl: <presigned url> }` → returns the updated `Service`.

So step 2 above is actually **two HTTP calls** (POST + GET) plus a *third* call to `UpdateServiceHandler`. The third call is the only one that touches `Service`.

### 3c. `saveBookingTypesMutation` — `PUT /dashboard/organization/services/:id/booking-types`

Constructed by `buildBookingTypesPayload` (`service-form-helpers.ts:29-39`) + `buildDurationOptionsPayload` (`booking-types-editor.tsx:61-83`):

```ts
{
  types: Array<{
    deliveryType: 'IN_PERSON' | 'ONLINE',
    price: number,           // halalas
    durationMins: number,
    isActive: true,
    useCustomAvailability: false,
    durationOptions: Array<{
      id?: string,           // present if option existed on server; absent for new
      label: string,         // "<durationMins> min"
      labelAr: string,       // "<durationMins> دقيقة"
      durationMins: number,
      price: number,         // halalas
      isDefault: boolean,    // first option in the array is isDefault=true
      sortOrder: number,
    }>,
    availabilityWindows: [],
  }>
}
```

Key shape properties:
- The payload is a **filtered+delta**, not a full list: `buildBookingTypesPayload` filters by `bt.enabled` (line 30). Disabled delivery types are **omitted** entirely.
- For each enabled type, the `durationOptions` array always begins with a synthetic "default" option (lines 64-72 of `booking-types-editor.tsx`), constructed from the booking-type-level `price` and `durationMins`. This synthetic default option carries `id: draft.defaultOptionId` when set, else no `id`.
- Additional duration options in `draft.durationOptions` (the editor's table rows) follow with `id: o.id` (when present) or no `id` for new.
- **All `id` values that are present are server-assigned UUIDs** that came back from a prior GET (the `mergeDraftsFromServer` line 227 maps each server option's `o.id` to a draft `{ key: o.id, id: o.id, … }`).

**Whether the full list is sent or a delta:** technically the full visible list of the user's current draft, but the draft is *seeded* from the server on load (`mergeDraftsFromServer` line 207-232). If the user has *not* touched the pricing tab, the booking-types PUT is skipped entirely (`bookingTypesDirty` is false → line 158 short-circuits). If the user *has* touched it, the PUT includes all rows as they currently appear in the draft, with `id` for surviving rows and no `id` for new rows.

## 4. Handler DB writes (per-mutation, in order)

### 4a. `UpdateServiceHandler` (`update-service.handler.ts:13-114`)

- **Reads** (lines 21-66): `Service.findFirst`, `Service.findFirst` (duplicate-name check). No lock or transaction.
- **Writes** (line 69-101): `prisma.service.update` with the field map (lines 71-96). Updates one row in `Service`. Cascade: `onDelete: Cascade` is set on `ServiceBookingConfig`, `ServiceDurationOption`, etc. → not relevant here (update, not delete).
- **Side effects** (lines 103-110): cache invalidation (`SERVICES_CACHE_PREFIX`, `ref:public-catalog`); event publish on `isActive` transition.
- **No `ServiceDurationOption` write.** This handler does not touch the duration-options table at all. Any price/duration the user types in the pricing tab is persisted to the service-level default via the booking-types PUT (4c), not via this PATCH.

The `price` and `durationMins` fields sent in the PATCH (lines 149-150) end up on the `Service` row but, per the resolver, the customer-facing flow reads `ServiceDurationOption`/`ServiceBookingConfig` first (Task 4 §4c). So the `Service.price` set here is a **fallback** for the INHERIT-mode step 3b (line 142-148 of `price-resolver.service.ts`) and a *display* value for the service card in the picker — not the live price the customer is charged.

### 4b. `UploadMedia` + `PresignUrl` + `UpdateServiceHandler` (image upload)

- `POST /dashboard/media/upload` writes one row in `Media` (file metadata + storage key).
- `GET /dashboard/media/:id/presigned-url` is read-only (signs a MinIO URL).
- The third call `PATCH /dashboard/organization/services/:serviceId {imageUrl: …}` is another `UpdateServiceHandler.execute` — identical to 4a but with only `imageUrl` set. Same `Service.update`, same cache invalidation.

### 4c. `SetServiceBookingConfigsHandler` (`set-service-booking-configs.handler.ts:12-182`)

This is the only handler that touches the duration-options table from the main save flow. The full transaction body (lines 56-155) does the following in order:

1. **`prisma.service.findFirst`** (lines 19-22, outside the transaction) — 404 if missing.
2. **Input validation** (lines 24-53) — window-time sanity, foreign-id guard. For any `option.id` in the payload, the handler `findMany`s those rows and rejects any whose `serviceId` differs from `cmd.serviceId` (lines 39-53).
3. **`prisma.serviceBookingConfig.deleteMany`** (line 60) — scope: `serviceId = cmd.serviceId AND deliveryType NOT IN deliveryTypes` (the new payload's types). **Hard delete.** This removes any `ServiceBookingConfig` row for delivery channels the user is *omitting* (e.g., disabling ONLINE).
4. **`Promise.all` over each type in payload** (line 66) — for each `t`:
   4a. `prisma.serviceBookingConfig.upsert` (line 68) — keyed by the UNIQUE `(serviceId, deliveryType)` (line 70). Creates or updates the `ServiceBookingConfig` row for this delivery channel.
   4b. **If `t.durationOptions` is present** (line 93 — and the form always sends it):
     - **`prisma.serviceDurationOption.deleteMany`** (line 95) — scope: `serviceId = cmd.serviceId AND deliveryType = <this type> AND (optionIds.length > 0 ? id NOT IN optionIds : (no id filter))`. **The `(optionIds.length > 0 ? … : {})` ternary (line 99) means: when the payload includes at least one option with an `id`, delete every row for this `(service, deliveryType)` whose id is NOT in that list. When the payload is empty (`optionIds.length === 0`), the `id` filter is omitted and **every** row for this `(service, deliveryType)` is deleted.**
     - **`Promise.all` per option** (line 102):
       - If `option.id` is present: `prisma.serviceDurationOption.updateMany` (line 104), scoped by `id AND serviceId` (line 108) — the `serviceId` is a defence-in-depth filter (lines 105-107 comment).
       - If `option.id` is absent: `prisma.serviceDurationOption.create` (line 121). **No UNIQUE check, no "find-existing" probe.**
   4c. `prisma.serviceAvailabilityWindow.deleteMany` (line 138) — hard delete all windows for `(serviceId, deliveryType)`. The form always sends `availabilityWindows: []`, so every save wipes all windows for the enabled delivery types.
   4d. `prisma.serviceAvailabilityWindow.createMany` (line 142) — only if `useCustomAvailability && length > 0`. The form always sends `useCustomAvailability: false` (line 126 of `service-form-helpers.ts`), so this `createMany` never runs from the dashboard.
5. **Return** (line 157) — re-fetches all three tables and groups them by delivery type.

The order of writes within a single `t` is: `upsert(BookingConfig)` → `deleteMany(DurationOption)` → `updateMany/create(DurationOption)` → `deleteMany(AvailabilityWindow)` → `(conditional) createMany(AvailabilityWindow)`. Different `t`s run in parallel (Promise.all at line 66).

**Side effects on cascade:** `ServiceDurationOption` has no `onDelete: Cascade` to other tables in the read paths used by the customer (no FK from `Booking.durationOptionId`; verified by checking `prisma/schema/bookings.prisma` — see Task 4's discussion of the FK pattern). However, the `deleteMany` will *orphan* any `Booking.durationOptionId` pointing at a deleted option; the booking row's `durationOptionId` becomes a dangling UUID. The resolver returns `''` when no option matches, so the booking row's id is technically a non-nullable FK — the `Booking.durationOptionId` may either be nullable or the relation is set to `onDelete: SetNull` / `onDelete: Restrict` per the schema. (Not re-read here; flagged in §8.)

## 5. Per-handler duplication question

**Question:** "Can this handler create two `ServiceDurationOption` rows with the same `(serviceId, deliveryType, durationMins)` if called twice on the same day?"

| # | Handler | Verdict | Evidence |
|---|---|---|---|
| 1 | `UpdateServiceHandler` | **NO** — does not touch `ServiceDurationOption` at all. | `update-service.handler.ts:69-101` only calls `prisma.service.update`. The `Service` table has UNIQUE only on `nameAr`/`nameEn` (line 64), not on price/duration. |
| 2 | `UploadMedia` + `UpdateServiceHandler` (image path) | **NO** — same as #1, only `Service.update` runs and the body is `{imageUrl}`. | `lib/api/services.ts:160-175`, third step is `api.patch(..., {imageUrl})` → `UpdateServiceHandler.execute` with only that field. |
| 3 | `SetServiceBookingConfigsHandler` | **YES — this is the verified duplication trigger.** | See §5a below. |
| 4 | `SetEmployeeDurationsHandler` (C9, fires independently) | **YES — can leave two `isActive=true` rows for the same `(serviceId, deliveryType, durationMins, employeeServiceId)`.** | See §5b below. |
| 5 | `SetEmployeeServiceOptionsHandler` (C6, fires independently) | **NO** — writes to `EmployeeServiceOption` only, which has UNIQUE `(employeeServiceId, durationOptionId, deliveryType)`. | `set-employee-service-options.handler.ts:54-78` uses `prisma.employeeServiceOption.upsert` keyed by that UNIQUE. |
| 6 | `SetServiceBookingConfigsHandler` again (for completeness, from the C4 path — but on a *different* delivery type the customer wants to re-introduce) | **YES** — but only because the same handler is the one that does it. | Same as #3. |
| 7 | `SetEmployeeCustomPricingHandler` (orphaned, no UI caller) | **NO** — writes to `EmployeeServiceOption` only, keyed on UNIQUE. | `set-employee-custom-pricing.handler.ts:73-94` does `upsert` on `EmployeeServiceOption`. (Note: it *creates* a `ServiceDurationOption` at line 56-70 if none exists for the delivery type — but the lookup at line 51-54 prefers existing and the create only fires when no anchor is found, and even then the partial UNIQUE on `(isDefault=true, isActive=true)` per `(serviceId, deliveryType)` would prevent a second default. So in practice no duplicate defaults. But two *non-default* rows could still be created if the handler ran twice with different delivery types and the same `durationMins` — that path is not exercised by the dashboard.) |

### 5a. `SetServiceBookingConfigsHandler` — the verified duplication trigger

The handler is the **only** one in the four-handler set that the main service-edit save hits. The duplication window is the `deleteMany` + `create` flow on lines 95-135.

**Scenario A — `bookingTypesDirty` is true and the user adds a new duration without removing the old one.** The form keeps the old row in `draft.durationOptions` and appends a new one (or, more typically, edits an existing row in place). The PUT includes all surviving ids plus the new row with no `id`. The handler `deleteMany`s by `id NOT IN optionIds` (line 99) — the surviving ids stay; the new row's `create` runs. **No duplicate from this path alone**, because the surviving ids are still in the table.

**Scenario B — `bookingTypesDirty` is true, the user *removes* a row, and the backend's `defaultOptionId` is dropped from the draft.** Here the form's `mergeDraftsFromServer` (line 207-232) puts every server-side option into `draft.durationOptions` *except* the default (line 226: `.filter((o) => !o.isDefault)`). The default id is in `draft.defaultOptionId` (line 228). The "first" option in `buildDurationOptionsPayload` carries `id: draft.defaultOptionId` (line 65). If the user adds a *new* default-style row (e.g., changed the booking-type's `durationMins` from 30 to 45) without explicitly editing the default id, the form replaces the synthetic default with a new one (`{ id: draft.defaultOptionId, durationMins: 45, … }`). The PUT includes the old default id with the new duration. The handler `updateMany`s that id (line 104) — the row's `durationMins` changes in place. **No duplicate from this path alone either**, because the default id is still being updated.

**Scenario C — the *actual* duplicate path: the same booking-type save fires twice in close succession, with the first one slightly before the second one runs the form's "build payload" against a stale `bookingTypes` state.**

Concrete sequence:
1. Admin edits 30→45 min, the pricing tab debounce fires (line 154 of `booking-types-editor.tsx`), the PUT goes out, the response invalidates the query, `mergeDraftsFromServer` runs again on the next render — and the synthetic default is rebuilt with `id: <new default id>, durationMins: 45, isDefault: true`.
2. The admin edits 45→60 min before step 1's response lands. The form state still has the old draft (`bookingTypesDirty` is true, line 137, so the merge from server is skipped — line 131). The new draft's `buildDurationOptionsPayload` builds an option with `id: <NEW default id from step 1's response>` (because `draft.defaultOptionId` was already updated when step 1's response came back) — but only IF step 1's response has actually landed.
3. **Race outcome:** if the user clicks "Save" *after* the debounce's PUT has completed but *before* the form-state is reset, the form sends a payload whose `defaultOptionId` is the *new* id (45 min), and the prior 30-min row still exists in the DB as the prior default. The PUT `updateMany`s the new id (45 min) and `create`s… no, wait — it doesn't, because the new id *was* the prior PUT's create. So the *prior* 30-min row is whatever happened to it.

The cleaner scenario where this is a real problem is **multi-delivery-type reordering**: the form's `mergeDraftsFromServer` reuses ids for *all* surviving non-default options. If a user saves, then re-saves with the same set of options but reorders them, the `sortOrder` changes but no row is created. **No duplicate from sortOrder edits alone.**

The actual *verified* duplicate-creating path is:

**Scenario D — re-saving after a save that changed the `defaultOptionId` mid-flight.** If the synthetic default's id is preserved in `draft.defaultOptionId` across renders (line 228), the form always sends the same id for the default slot. **No duplicate.** But if the user *adds a new duration option* that has the same `(durationMins, price, deliveryType)` as the synthetic default and the synthetic default still carries its id, the PUT sends *two* options with the same `(serviceId, deliveryType, durationMins)` and *different* ids (the old default id and the new row's id). The `updateMany` on line 104 only updates the row with the explicit id; the `create` on line 121 inserts a fresh row. **Now there are two rows for the same `(serviceId, deliveryType, durationMins)`** — one with `isDefault=true` and one with `isDefault=false`. The schema's only UNIQUE on this table is the partial UNIQUE on `(isDefault=true AND isActive=true)` per `(serviceId, deliveryType)` — which does not constrain non-default rows. So both rows are accepted, and the result is a duplicate.

**This is the verified structural trigger.** The form's `buildDurationOptionsPayload` does not dedupe by `(durationMins, price, deliveryType)`, and the handler does not either. The "default" row and any user-added row with the same `durationMins` will both be persisted side-by-side.

The more aggressive variant — **Scenario E — happens when a user adds a non-default option that *looks* like the new default.** After a save, the new default's id is reflected in the form. If the user then types the same duration+price into the "additional options" list, the form sends two options: the default (id-bearing) and the new (id-less). Handler `updateMany` + `create` ⇒ two rows, same triple.

The most realistic operator-driven variant — **Scenario F — comes from the form's "always send one default even if the user didn't touch it" behavior.** `buildDurationOptionsPayload` (line 61-83) always emits a synthetic default, even when the user only edited a *non-default* option. So every save upserts the default row and adds/updates the non-default rows. If the user only added one non-default option, the save contains 2 options. If the user *also* added a second non-default option that happens to have the same `durationMins` as the default, the save contains 3 options with the same triple in positions 1 and 3. Handler writes 2 updateMany (positions 1 and 2) + 1 create (position 3, id-less) ⇒ duplicate.

**The `deleteMany` (line 95) does not prevent this** because the default's id is in the payload. The `id NOT IN optionIds` filter only catches rows whose id is *not* sent; it does not catch two rows in the payload that share a triple.

### 5b. `SetEmployeeDurationsHandler` — the soft-deactivate trap

C9 (per-row edit of the practitioner's custom pricing) is independent of the main form save. It fires from `EmployeeCustomPricingRow.handleSave` (Task 3 line 57). Per-handler analysis:

- **Lines 56-72 (update branch):** an `id`-bearing item is `updateMany`'d in place. If two saved calls send the same id, the same row is updated twice — no duplicate.
- **Lines 83-101 (create branch):** an id-less item is `create`'d. If the user adds the same `(serviceId, deliveryType, durationMins, employeeServiceId)` twice in a row, the handler creates *two* rows, neither of which has the other in `keepIds`. The soft-deactivate at line 105-114 then deactivates any active rows *not* in `keepIds` — but both are in `keepIds` (each new create pushed its own id), so **both stay active**. Result: two `isActive=true` rows for the same `(serviceId, deliveryType, durationMins, employeeServiceId)`. The schema has **no** UNIQUE on that 4-tuple. **Verified duplicate trigger.** Lower blast radius than 5a because it requires a per-employee edit; but the handler does not protect against it.
- **The "revert to inheriting" path (lines 44-50):** an empty payload soft-deactivates *all* owned rows. Clean.
- **The "soft-deactivate leftovers" path (lines 105-114):** the keep-vs-leftover math uses `id` equality, not triple equality. If two rows with the same triple both made it into `keepIds`, neither is deactivated. Same root cause as above.

This handler is **the practitioner-side counterpart to 5a** — same pattern, different ownership scope. Not on the main service-edit save path; triggered from the per-practitioner custom-pricing editor.

## 6. Cross-handler contamination — does `set-service-booking-configs`'s `deleteMany` delete practitioner-owned rows?

**Short answer: NO — the `deleteMany` is scoped by `serviceId` and `deliveryType` only (line 95-101), with no `employeeServiceId` filter, but in the *current dashboard code path* this is safe because the form never sends a `durationOption.id` that points at a practitioner-owned row.**

The current form payload comes from `buildDurationOptionsPayload` (`booking-types-editor.tsx:61-83`), which is fed by `mergeDraftsFromServer` (line 207-232) and the user's edits in the pricing tab. The merge at line 226 filters out `o.isDefault`, and the synthetic default at line 64-72 carries `id: draft.defaultOptionId` — a service-level default id. The handler then `updateMany`s those ids (line 104), with a defence-in-depth `serviceId` filter (line 108) but no `employeeServiceId` filter on the `updateMany`.

**Two safety levels against contamination:**

1. **The form never produces a practitioner-owned id.** `mergeDraftsFromServer` reads from `GET /dashboard/organization/services/:id/booking-types` → `get-service-booking-configs.handler.ts`. That handler's response is built from `ServiceDurationOption.findMany({ where: { serviceId } })` — **without an `employeeServiceId` filter** in the current implementation (verified by reading the response builder at `set-service-booking-configs.handler.ts:160-181`: `durationOptions` for a config is `durationOptions.filter((option) => option.deliveryType === config.deliveryType)` — no employeeServiceId filter either way). So the dashboard's GET *does* return practitioner-owned rows mixed into the per-config `durationOptions` array.

   **This is a real contamination vector in the read path.** The dashboard may render practitioner-owned rows inside the service-level pricing tab, where the user could in theory see them but cannot edit them via the form (no `id` is carried for them if they're not the default — line 226 filters out `isDefault` only, so non-default practitioner-owned rows would actually appear in the merged draft as "additional options"). If the user *edits* one of those rows, the form would include its id in the PUT payload. The handler's `updateMany` at line 104-119 has a `where: { id, serviceId }` filter but **no `employeeServiceId` filter**, so a row owned by practitioner X could be updated by a service-level admin save. **The `updateMany` is the cross-handler contamination point in the read-modify-write path.**

2. **The `deleteMany` is the bigger contamination vector if the guard is bypassed.** The `deleteMany` at line 95 has *no* `employeeServiceId` filter. If a future caller (a custom dashboard surface, a script, a buggy code path) sent a payload whose `optionIds` were a strict subset of the practitioner-owned rows, the `deleteMany` would hard-delete every practitioner-owned row not explicitly named. The current dashboard does not exercise this path, but the handler does not protect against it.

**The "latent footgun" verdict (Task 3 note 3a) is confirmed.** Today's code does not exercise it. The handler's `updateMany` (line 104) and `deleteMany` (line 95) both lack `employeeServiceId` filters, but only the `updateMany` is reached by the current form (via the mixed-ownership read path) — and that one *mutates* practitioner-owned rows without re-checking ownership. The right fix is to add `employeeServiceId: null` to the `where` clauses at lines 95 and 108 of `set-service-booking-configs.handler.ts`. That makes the service-level admin save strictly bounded to service-level defaults.

## 7. Step-by-step trace — the actual save

```
Admin opens /dashboard/services/:id/edit
  → page.tsx renders <ServiceFormPage mode="edit" serviceId={id} />
  → ServiceFormPage mounts:
    → useQuery fetchService(apiServiceId) → GET /services/:id → reads Service row (line 72-77)
    → useServiceBookingTypes(apiServiceId) → GET /services/:id/booking-types
      → SetServiceBookingConfigsHandler returns configs (handler:160-181)
      → configs[].durationOptions = ALL ServiceDurationOption rows for the service, including
        practitioner-owned ones (handler:178, no employeeServiceId filter)
    → useCategories() → GET /organization/categories (parallel, line 84)
    → useDepartmentOptions() → GET /departments (parallel, line 85)
  → useEffect populates form values (line 106-127)
  → useEffect merges booking-types into local draft via mergeDraftsFromServer (line 130-133)
    → draft.durationOptions = server.durationOptions.filter(!isDefault).map(o → {id: o.id, …})
    → draft.defaultOptionId = server.durationOptions.find(isDefault)?.id
  → User can see: name, description, image, prices per delivery type, per-employee assignments

Admin edits the 30 min IN_PERSON price from 400 → 450 SAR
  → User clicks the input in PricingTab (a debounced input)
  → updateType() fires (booking-types-editor.tsx:144-157)
  → Local state `bookingTypes` updates; `bookingTypesDirty` is set to true (handleBookingTypesChange, line 137)
  → Debounce timer of 800ms starts
  → After 800ms, save() runs (line 117-134) and:
    → mutation.mutateAsync({ types: buildBookingTypesPayload(bookingTypes) })
    → BUT: the PricingTab in ServiceFormPage is NOT a BookingTypesEditor component —
      it is a `PricingTab` component (imported at line 18 from create/pricing-tab.tsx).
      This PricingTab in the create/edit flow does NOT use the debounced auto-save; it
      only mutates local state via handleBookingTypesChange. The PUT fires on main form
      submit only.
  → After 800ms, nothing happens. The user must click "Save" at the bottom of the form.

Admin clicks the main "Save" button (line 329)
  → onSubmit fires (line 202-205)
  → handleSubmit runs (line 141-199)
  → Step 1: updateMut.mutateAsync({ id, ...buildPayload(formValues), price: 45000, durationMins: 30 })
    → PATCH /dashboard/organization/services/:id
    → UpdateServiceHandler:
      → reads Service (line 21)
      → if expectedUpdatedAt was sent, conflicts (line 26-31) — not sent from the form
      → duplicate name check (line 51-66) — only on nameEn/nameAr, not on price
      → Service.update (line 69-101): writes nameEn/nameAr, prices, deposit, etc.
        → Service.durationMins = 30, Service.price = 45000 (the new values)
        → does NOT touch ServiceDurationOption
      → cache invalidation (line 103-104): invalidates `ref:public-catalog` and services list
      → returns the updated Service
  → Step 2: if pendingAvatarFile.current is set, uploadServiceImage runs (line 153-156)
    → POST /dashboard/media/upload (writes 1 Media row)
    → GET /dashboard/media/:id/presigned-url
    → PATCH /dashboard/organization/services/:id {imageUrl: <presigned url>}
      → UpdateServiceHandler again, with only imageUrl
  → Step 3: if bookingTypesDirty is true (it is), saveBookingTypesMutation runs (line 158-160)
    → PUT /dashboard/organization/services/:id/booking-types
    → payload is the FULL list of enabled types + their durationOptions (line 41-55 helpers)
    → SetServiceBookingConfigsHandler:
      → transaction body (line 56-155)
      → deleteMany ServiceBookingConfig where deliveryType NOT IN payload (line 60)
      → for each type in payload (parallel):
        → upsert ServiceBookingConfig (line 68)
        → deleteMany ServiceDurationOption where (id NOT IN payload's option ids)
          — line 95-101. Surviving rows: only the ones in the payload
        → for each option (parallel):
          → updateMany if id present, create if id absent (line 102-135)
        → deleteMany ServiceAvailabilityWindow (line 138) — wipes all windows for this type
          because the form always sends availabilityWindows: []
        → (createMany skipped because useCustomAvailability is false)
      → re-fetches all rows for the service (line 161-180) and returns
  → toast.success and router.push("/services") (line 162, 192)

The customer-facing read path then sees the new prices via:
  → GET /public/services (ref:public-catalog, 300s cache — invalidated by the PATCH at step 1)
  → GET /public/services/:serviceId/practitioners/:employeeId/booking-options
  → Customer picks a duration; resolver returns the new ServiceDurationOption.price.
```

## 8. Gaps and concerns

1. **PricingTab component is separate from BookingTypesEditor.** The component used inside the service-form-page (line 18, imported from `create/pricing-tab.tsx`) does NOT run the 800ms debounced auto-save. The `BookingTypesEditor` *does* (line 144-157), but it's only used in the create path's first step (not on the edit page). This means a user on the edit page cannot lose work to a debounce race — the save is atomic at the main form submit. **Good for correctness, but flag:** there are two `BookingTypeRow` consumers with very different save semantics.
2. **`mergeDraftsFromServer` does not filter practitioner-owned rows** (the `get-service-booking-configs` response includes them in `config.durationOptions`). The user can see (and attempt to edit) practitioner-owned rows in the service-level pricing tab. If they edit such a row, the form sends the practitioner-owned id in the PUT, and the handler's `updateMany` (line 104) will mutate it without the `employeeServiceId` guard. **Real, reachable contamination path** — not just latent. Suggested fix: filter `employeeServiceId IS NULL` in `get-service-booking-configs` (or in `mergeDraftsFromServer` on the client) AND add the `employeeServiceId: null` filter to the `updateMany` and `deleteMany` on lines 95 and 108.
3. **Cascading-delete side effect on `Booking.durationOptionId`.** Step 4c's `deleteMany ServiceDurationOption` (line 95) can delete rows that existing `Booking` rows reference. The schema's `Booking.durationOptionId` is either nullable or has a `SetNull`/`Restrict` cascade — the trace did not re-verify. If `SetNull`, historical bookings keep their `price`/`durationMins` snapshot (good) but lose the link to the option; if `Restrict`, the handler would throw and roll back. **Not a Task 5 deliverable to resolve, but flag for follow-up.**
4. **Per-handler duplication verdict (summary):** the verified primary duplication trigger is `SetServiceBookingConfigsHandler` — confirmed by §5a. The secondary trigger is `SetEmployeeDurationsHandler` (C9) for practitioner-owned rows — confirmed by §5b. `UpdateServiceHandler`, `UploadMedia`, and `SetEmployeeServiceOptionsHandler` do not write to `ServiceDurationOption` directly, so they cannot create duplicates there. `SetEmployeeCustomPricingHandler` is orphaned (no UI caller) and the only `ServiceDurationOption` write it does is a defensive `findFirst` then `create` for an anchor when none exists, so it is not a duplicate source in practice.
5. **The re-save-after-partial-save pattern is the most likely production duplicate driver.** Every save wipes all `ServiceAvailabilityWindow` rows for the enabled types (line 138) and re-creates only what the form sends (which is `[]`). This is unrelated to duration-option duplication but is the same anti-pattern: hard-delete + re-create with payload-derived set, where the payload can be stale.

## 9. One-line summary for Task 7

**The verified duplication trigger is `SetServiceBookingConfigsHandler` (`set-service-booking-configs.handler.ts`) at line 121 — `prisma.serviceDurationOption.create` runs unconditionally when `option.id` is absent, and there is no UNIQUE constraint on `(serviceId, deliveryType, durationMins)` in the schema (Task 2) and no application-layer dedup in either the form's `buildDurationOptionsPayload` (`booking-types-editor.tsx:61-83`) or the handler's per-option branch (line 102-135); the upstream `deleteMany` (line 95) only filters by `id NOT IN optionIds`, not by triple equality, so a payload that includes a non-default option with the same `(deliveryType, durationMins)` as the synthetic default produces two `ServiceDurationOption` rows for the same triple. The cross-handler contamination vector (handler `updateMany`/`deleteMany` lacking `employeeServiceId` filter) is real but only reachable when the dashboard GET response (`get-service-booking-configs`) returns practitioner-owned rows — which it does today (line 178, no filter) — so the form can send a practitioner-owned id back to the service-level save.**
