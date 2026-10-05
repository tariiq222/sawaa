# Late session entry implementation plan

> For agentic workers: REQUIRED SUB-SKILL: use superpowers:subagent-driven-development with parallel-lanes for isolated independent packages.

**Goal:** Reception records an actual past session, its chosen status and payment facts, visibly marked as entered late, in operational accounts.
**Architecture:** One staff-only transactional command, nullable audit/receipt fields, guarded event consumers, explicit effective collection date semantics, and a separate reception form.
**Tech Stack:** NestJS, Prisma 7/PostgreSQL, Next.js/React, TanStack Query, Jest/Vitest/Playwright.
**Spec:** ../specs/2026-10-05-late-session-entry-design.md (approved by the user's request to launch implementation agents).

## Global Constraints

- Preserve unrelated work. No commit, push, merge, deployment, shared/live data write, branch deletion or destructive cleanup.
- No authorization, role, secret, encryption-AAD, default VAT, legacy import, normal booking or provider/refund refactoring.
- New migrations only; nullable additive fields, no backfill. Concurrent expression indexes on hot payment tables, reviewed SQL and local disposable migration acceptance.
- Fixed source RECEPTION and isHistoricalImport=false. lateEntryRecordedAt/By come from server/actor; isLateEntry is derived. Immutable operational entry times remain distinct from actual session/receipt facts.
- Invoice issuedAt and settlement paidAt remain actual system time; effectiveReceivedAt never changes issuance/QR. Amounts are integer halalas; amountHalalas is net before current VAT policy.
- COMPLETED/CONFIRMED can carry receivables. CANCELLED/NO_SHOW are zero-amount UNPAID only. COMPLETED end is past; CANCELLED requires reason/time; NO_SHOW requires actual noShowAt.
- All booking/status/invoice/payment/idempotency/outbox changes commit atomically. No external provider call. Previous receipts allow factual partial amounts independently of today's deposit settings.
- No automatic booking notice, reminder, rating, Zoom, status overwrite or unsolicited historical receipt/staff payment notice. Document creation/access remains available.
- Workers are not alone; never overwrite other lanes or spawn children. Work only in assigned checkout/files. Focused RED/GREEN diagnostics only; no full build/lint/test suites or OpenAPI sync in workers before integration.

## Shared contracts (fixed before dispatch)

- POST /api/v1/dashboard/bookings/late-entry. DTO/handler names RecordLateSessionDto/RecordLateSessionHandler under modules/bookings/record-late-session; controller wiring in api/dashboard/bookings.controller.ts.
- Request: clientId, branchId, employeeId, serviceId, deliveryType (existing enum), scheduledAt ISO, durationMins positive integer, status COMPLETED|CONFIRMED|NO_SHOW|CANCELLED, amountHalalas nonnegative integer, notes?, paymentMode UNPAID|PREVIOUSLY_RECEIVED|COLLECT_NOW, creationIdempotencyKey; conditional paymentMethod/paymentAmountHalalas; PREVIOUSLY_RECEIVED requires receivedAt ISO, receiptEvidenceRef, receiptEntryReason; CANCELLED requires cancelledAt,cancellationReason; NO_SHOW requires noShowAt. Reject unauthorized/system fields and inappropriate conditional fields. Methods follow enabled manual CASH/BANK_TRANSFER/MADA/TABBY.
- Response: {booking: standard Booking response, invoice: standard invoice or null, payment: standard payment or null, outstanding: integer halalas, isLateEntry:true, lateEntryRecordedAt:ISO, lateEntryRecordedBy:string}; booking itself exposes isLateEntry, lateEntryRecordedAt, lateEntryRecordedBy and optional actor display name from existing safe user projection.
- Booking nullable fields lateEntryRecordedAt DateTime?, lateEntryRecordedBy String?. Payment nullable effectiveReceivedAt DateTime?, receiptRecordedBy String?, receiptEvidenceRef String?, receiptEntryReason String?. No cross-domain FK additions.
- Payment public projection adds those fields plus collectionDate (effectiveReceivedAt ?? createdAt ISO). Existing createdAt/processedAt remain visible. Reporting helper owns explicit CREATED/PROCESSED fallback paths.
- Booking list DTO adds isLateEntry?:boolean, mapper returns late marker on list/detail. Timeline uses actual log time with explicit late-entry facts.
- Existing dashboard employee/service catalog query DTOs add historicalContext?:boolean for existing staff read authorization only; true admits archived nondeleted references, preserves bindings and normal defaults. Dashboard lane consumes exactly historicalContext:true and separates query keys. If necessary owning endpoint names are communicated before changing contracts.
- New event finance.previous-receipt.recorded has invoiceId/paymentId/bookingId/amount/currency/effectiveReceivedAt/recordedAt/actorId and organizationId DEFAULT_ORG_ID; durable transaction outbox only, no normal PaymentCompleted/DepositPaid for previous receipts.

## Review Focus

1. Unpaid/zero/terminal states: no phantom invoice-paid/payment; forbidden receipt fields rejected.
2. Partial previous receipts and prepayments: 15000 against 40000 leaves 25000 despite present deposit setting; actual receipt date may precede session; nonzero VAT fixture distinguishes net/total without changing default.
3. Concurrent same-key retry, different receipt evidence/date and rollback: no duplicates, changed body 409, replay before mutable eligibility.
4. Event/cron paths including partial DepositPaid: late selected status preserved, no Zoom/notifications; ordinary paths retain behavior and document access.
5. Reporting date range/sort/group/export and Riyadh midnight: effective historical receipt belongs to its date; null-field ordinary payments preserve CREATED/PROCESSED semantics.

### Task 1: Recording, persistence, staff API and financial use case

**Target / owned files:** apps/backend/prisma/schema/{bookings,finance}.prisma; new migration directories only; modules/bookings/record-late-session/**; modules/finance/record-previous-receipt/** and new events/previous-receipt-recorded.event.ts; bookings.module.ts and finance.module.ts; api/dashboard/bookings.controller.ts; booking-row.mapper.ts, list-bookings/**, get-booking/**, booking-timeline projection; relevant people/employee and org-experience/service staff catalog DTO/handlers/controllers and tests. Do not edit report/event consumers/crons/list-payments (Task 2).

**Change:** Implement shared contracts and all spec transactional rules. Use existing person-reference locks, number allocator, money helpers, outbox; preserve service snapshots and binding. Register an independently exported previous receipt command, and use existing ProcessPaymentHandler transaction port for COLLECT_NOW. No ordinary BookingCreated event. Use current CASL policy checks for conditional invoice/payment without widening grants. Refactor new handler into focused helpers if needed, no giant copied normal create handler. Implement additive migration and optional expression index migration matching Task 2 helper.

**Acceptance / sequence:**
- [ ] Read root/app instructions, spec, migration charter, clinic contract and TDD test guidance.
- [ ] Write focused DTO/handler/mapper tests first; record expected RED for missing behavior.
- [ ] Add schema/SQL and minimal implementation; generate Prisma only in your own installed dependency tree after setup completes.
- [ ] Execute only focused Jest files with --runInBand; report RED/GREEN commands and output; no complete suite/build/lint.
- [ ] Cover 14 spec acceptance cases belonging to command, permission boundaries, rollback, idempotency, actual timestamps, nonzero VAT fixture, archived bindings/overlap. Prepare real-SQL concurrency test for orchestrator, no shared database.
- [ ] Write report with changed files, contract decisions, focused evidence and blockers; no commits.

### Task 2: Effective collection reporting, event guards and cron exclusions

**Target / owned files:** modules/finance/payment-collection-date.helper.ts (new) and tests; finance/list-payments/**; ops/generate-report/{revenue-report-query.helper,revenue-report.builder,overview-report.builder,excel-export.builder}.ts and their tests; dashboard/get-dashboard-stats/** and get-top-performers/**; bookings/payment-completed-handler/**, deposit-paid-handler/**; ops/cron-tasks booking-noshow/autocomplete/appointment-reminders/rating scheduling handlers; comms/events payment/deposit/receipt consumers; finance/issue-invoice-receipt/** and send-invoice-receipt/** as necessary. Do not edit modules/schema/controller/booking mapper (Task 1).

**Change:** Consume fixed fields, explicit SQL/prisma fallback helper with range/sort/group/export consistency, payment response collectionDate and metadata. Suppress status/Zoom/events/cron activity for marked late entries, including both full and partial new manual payment events. Preserve current document generation and explicit document access, suppress unsolicited delivery. Inventory exact relevant subscribers before edits, no normal-flow behavior changes. Prior receipts emit separate event (Task 1).

**Acceptance / sequence:**
- [ ] Write focused regression tests and observe RED before behavior edits.
- [ ] Implement only assigned paths; use nullable schema contract without changing schema. Tell root if client regeneration is needed; independent package installation required.
- [ ] Verify ordinary null fallback behavior, actual receipt date ranges/sort/group/export, Riyadh boundary, late full/partial consumers, late cron exclusion and ordinary consumers retained.
- [ ] Run only focused Jest files --runInBand; no full suites/build/lint, provider/API/data writes.
- [ ] Report source inventory, all changed files, RED/GREEN evidence, any flow that remains unresolved; no commits.

### Task 3: Reception form, badges, filters, timeline and receipt display

**Target / owned files:** apps/dashboard/components/features/bookings/**; hooks new use-record-late-session.ts and catalog query hooks as needed; lib/api new late-session.ts and booking endpoints consumption; lib/types/booking.ts and new late-session.ts/financial types if needed; lib/schemas/new late-session.schema.ts; lib/query-keys.ts; AR/EN bookings/payment translations; test/unit/features/bookings/**; booking reception entry page orchestration if needed. No backend or generated OpenAPI files.

**Change:** Independent form beside new appointment; reuse shared catalog selectors, explicit historicalContext keys, past date/time in Riyadh (including today), editable actual duration/net price, required status timestamps and conditional payment fields; no slot check. Show actual current issued invoice implications and prior invoice choices (open existing internal booking; external prevents submit). Existing permissions gate creation/payment controls. Atomic single API call with persistent idempotency key across retry and change key after successful operation or materially edited draft. Display outstanding and optional VAT according to existing policy. Mark lists/detail/timeline, filter late entries, distinguish actual receipt versus system entry time. Respect line limits, i18n AR/EN, RTL, accessibility, existing UI tokens.

**Acceptance / sequence:**
- [ ] Write focused schema/form tests first and observe RED; implement minimal production code.
- [ ] Test payload halalas, time conversion, default completed, partial previous receipt, no phantom conditional fields, terminal zero/unpaid, unsupported prior invoice prevention, single atomic request/retry key and success details.
- [ ] Test late badge/filter/details and ordinary bookings unchanged.
- [ ] Run focused Vitest files only; no full build/lint/test suite. Report paths/RED/GREEN/evidence and blockers; no commits.

### Task 4: Integrate, regenerate contracts, validate and review (sequential)

**Owner:** Coordinator collects nonoverlapping working-tree patches into integration worktree; no git merge/cherry-pick/commit. A follow-up implementation agent owns any contract/type fixes, packages/api-client manual updates and generated snapshot/type sync. Root owns final checks and local acceptance; independent Astra high reviewer checks each package and whole diff without duplicate tests.

- [ ] Confirm three lanes preserve unrelated work; package tracked and new files into immutable review patch, detect file overlaps before applying.
- [ ] Integrate schema/command then report/events then dashboard. Generate Prisma in integration. Run pnpm openapi:sync; inspect generated changes and manually update api-client only if applicable after reading its instructions.
- [ ] Root runs affected full backend/dashboard unit suites once, typechecks/builds, migration immutability, dashboard smoke and dedicated disposable PostgreSQL migration/rollback/idempotency/range tests; run local endpoint/UI acceptance.
- [ ] Sandbox gate: verify whether safe Moyasar sandbox checks can run; do not touch live provider/data or hide unavailable credentials. Incomplete sandbox/staging owner acceptance remains explicit release limitation.
- [ ] Independent package and full branch review; return findings to owner, focused recheck changed fixes, root repeat only covering final changes.
- [ ] Preserve all local uncommitted work/worktrees; provide changed-file links and actual evidence, remaining release gates, no unauthorized consequential action.

## نتيجة التنفيذ والتحقق المحلي — 2026-10-05

اكتمل التنفيذ محليًا على `codex/late-session-integration` المبني على develop `33556d687e9e2a3b54959cd3d7564e485a8b2948`. جميع مسارات العمل محفوظة، ولم يُنفذ commit أو push أو merge أو نشر أو تعديل بيانات مشتركة.

- Backend: 877 مجموعة / 8,469 اختبار ناجح، واختبار واحد متروك حسب إعداد المشروع. Typecheck وbuild ناجحان.
- Dashboard: 290 ملف / 2,254 اختبار ناجح؛ typecheck وبناء إنتاجي ناجحان.
- API client: 12 ملف / 143 اختبار ناجح؛ typecheck وendpoint-manifest drift ناجحان.
- PostgreSQL/HTTP/JWT/CASL: 13 اختبارًا فعليًا ناجحًا؛ تغطي الذرية والرجوع، والتزامن، وإعادة المحاولة، والتعارض مع سجل مستورد، والتواريخ الصارمة، وصلاحيات الاستقبال والسياق المحدود، وقيمة VAT اختبارية دون تغيير الافتراضي.
- قاعدة اختبار مستقلة: نجحت هجرتان جديدتان وفهارسهما؛ 114 ملف هجرة سابقًا مطابق للأصل. تحققت التقارير وقائمة التحصيل فعليًا من التصفية والعدد والترتيب عبر عدة صفحات وتوقيت الرياض وExcel وEXPLAIN للفهرس.
- Outbox/Postgres/BullMQ: صُرّف 61 حدثًا تدقيقيًا ثم حدث دفع عادي؛ 64 وظيفة تدقيق مكتملة، صفر فشل. المستهلك التدقيقي بلا إشعارات أو آثار مالية.
- Dashboard smoke: 41 ناجحًا وواحد متروك (ميزة المحادثة معطلة في بيئة الاختبار). استُخدم خيار المشروع الموجود لتعطيل throttling في الخادم التجريبي المعزول فقط بعد اصطدام تسجيل الدخول الآلي بـ429؛ لا تغيير في guards أو إعدادات مشتركة.
- جميع ملفات المنتج TypeScript المعدلة اجتازت ESLint (43 backend و34 dashboard)، وAR/EN parity وOpenAPI coverage وdashboard API drift وgit diff --check ناجحة. جُدد OpenAPI وأنواع الواجهة من خادم النسخة المعزولة.
- اختبار المتصفح من موظف استقبال: جلسة مكتملة في 4 أغسطس، استلام سابق في 4 سبتمبر، إدخال في 5 أكتوبر؛ إجمالي500 ريال، مدفوع100، متبقٍ400. ظهرت علامة التسجيل والتواريخ والفاتورة والسجل كما هو متوقع.
- مراجعات Astra المستقلة: backend والتقارير والواجهة PASS بعد إصلاح الملاحظات؛ أضيف مستهلك حدث التحصيل السابق لمنع تعطيل طابور أحداث الحجوزات العادية.

النتيجة قبول تقني محلي فقط. فحص وصول Moyasar TEST أعاد403؛ لم تُنفذ معاملة sandbox. يلزم التحقق الخارجي قبل الإصدار، ثم staging وقبول المالك عند الإذن بالنشر. لا تثبت هذه الاختبارات اعتماد ZATCA أو الامتثال الضريبي الكامل.

الخادم المحلي للتجربة: backend55620، dashboard55623، PostgreSQL55561، Redis55562، MinIO55563. جميعها لقاعدة بيانات اصطناعية مستقلة. بقيت بيانات الإنتاج والخدمات الأخرى كما هي. قياس الاستهلاك غير مكتمل: UUID/baseline للوكالات غير متاحة، لذلك إجمالي استهلاك المهمة ووفورات الحصة غير معروفين.

قرارات سير العمل: طلب إطلاق الوكالات اعتمد التصميم والتنفيذ؛ توازت ثلاث حزم كتابة منفصلة؛ حُفظ العمل بلا commit أو تنظيف؛ رُبط يوم التحصيل في overview بتوقيت الرياض؛ أضيف سياق محدود بصلاحية إنشاء Booking القائمة بدل توسيع قراءة Settings. الأدلة التفصيلية في `.superpowers/sdd/2026-10-05-late-session-entry/`.
