# Sawa Production Readiness Audit — 2026-05-21

Single-tenant family counseling SaaS. Audit performed against current `main` (commit `af063af`).
Scope: code quality, security, database, API/integration, frontend/dashboard, DevOps/infra, testing, business logic, PDPL+ZATCA compliance, operational readiness.

---

## Executive Verdict

**النظام ليس جاهز للإنتاج بدون معالجة المشاكل P0.** البنية الهندسية ممتازة (vertical slices، state machine، HMAC webhook، AES-GCM للأسرار، helmet+throttler+rate-limit، اختبارات منظمة). لكن فيه فجوات امتثال قانوني واضحة:

- **ZATCA Phase 2 غير مطبّق** — صفر دعم لـ QR/TLV/CSID/XML signing. أي إيرادات VAT تتجاوز 3M ر.س سنوياً تعني مخالفة.
- **PDPL — صفر آلية موافقة (consent) موثّقة، صفر endpoints لحقوق صاحب البيانات، استضافة على Hetzner ألمانيا بدون تصريح SDAIA لنقل البيانات خارج المملكة.**
- **لا توجد سياسة احتفاظ بيانات (retention) مكوّدة** — كل سجلات OTP وActivityLog وNotification وSmsDelivery تتراكم بلا حد.

أمنياً النظام صلب (HMAC، AES-256-GCM/HKDF، Throttler، prod boot guards على الـ secrets). فيه ثلاث ثغرات أمنية متوسطة-مرتفعة (bcrypt cost 10، race في login lockout، presigned URL بلا ownership check) قابلة للإصلاح في PR واحد.

| Severity | Count |
|---|---|
| P0 (Blocker) | 6 |
| P1 (High) | 10 |
| P2 (Medium) | 28 |
| P3 (Low) | 14 |

---

## 1. Code Quality & Architecture

✅ Vertical slices مطبّقة بدقة. ✅ Type safety ممتاز (8 ملفات فقط فيها `any` بالباك إند، صفر في الداشبورد production). ✅ صفر `console.log` تائه بالباك. ✅ Global exception filter موجود. ✅ Naming نظيف.

| ID | Sev | Issue | Location |
|---|---|---|---|
| ARCH-01 | P1 | كنترولر منتفخ (1046 سطر) فيه منطق branchId resolution | `apps/backend/src/api/dashboard/people.controller.ts` |
| ARCH-02 | P1 | تكرار طبقة HTTP بين `apps/dashboard/lib/api/` و `packages/api-client/src/modules/` — 33 ملف × 2 = درج درّاجة | كلاهما |
| ARCH-03 | P2 | `bookings.controller.ts` (513) و `organization-settings.controller.ts` (435) فوق الحد | api/dashboard |
| ARCH-04 | P2 | 3 صفحات production لا زالت تستدعي `useTerminology` الميت (هيك مكتوب بالـ root CLAUDE.md إنه stub) | dashboard employees/clients/bookings pages |
| ARCH-05 | P3 | لا توجد custom domain exceptions (BookingException, FinanceException) — كل شيء `BadRequest/Conflict` عام | apps/backend/src/common/filters |
| ARCH-06 | P3 | Magic numbers في retry delays | `comms/resilient-notification-dispatcher` |

---

## 2. Security (الأهم)

✅ Helmet ✅ Cookie parser ✅ JSON body ≤ 100kb ✅ Rate limit على `/api/v1/auth` (20/15min) + Throttler global ✅ trust proxy 1 ✅ Boot guards على placeholder secrets ✅ Cookies `httpOnly+sameSite=lax+secure(prod)` ✅ AES-256-GCM/HKDF للـ provider creds ✅ HMAC `timingSafeEqual` على Moyasar webhook + إعادة جلب من Moyasar API للتحقق من amount.

| ID | Sev | Issue | Location |
|---|---|---|---|
| SEC-01 | P1 | bcrypt SALT_ROUNDS=10 لكلمات السر (OWASP 2025 يوصي ≥12) | `apps/backend/src/modules/identity/shared/password.service.ts:6` |
| SEC-02 | P1 | `OWNER_EMAILS` غير معرّف في Joi schema — Boot ينجح بدون أي owner | `apps/backend/src/config/env.validation.ts` + `owner-only.guard.ts:24` |
| SEC-03 | P1 | Race في login lockout (read-then-update بدون transaction، attempt counter ممكن يُعاد للصفر بالتوازي) | `modules/identity/login/login.handler.ts:85-99` |
| SEC-04 | P1 | Presigned URL يُصدَر بدون ownership check — أي user عنده `read:Setting` يقدر يولّد URL لأي `File.id` | `modules/media/files/generate-presigned-url.handler.ts:19-26` |
| SEC-05 | P2 | Refresh-token rotation race في الـ legacy endpoint (يقرأ ثم يعدّل بدون قفل ذرّي) | `api/public/auth.controller.ts:158-180` |
| SEC-06 | P2 | Multer limit (10MB) ≠ handler limit (25MB) — تناقض بين دخولين | `media.controller.ts:40` vs `upload-file.handler.ts:15` |
| SEC-07 | P2 | Branding يحقن قيم DB غير مفلترة في `<style>` (colors/fonts) — تحقق برتوكول URL موجود لكن hex/charset لا | `apps/website/features/branding/branding-style.tsx:31` |
| SEC-08 | P2 | Email-builder preview يستخدم `dangerouslySetInnerHTML` — الـ renderer يـ escape لكن أي block جديد يفلت | `dashboard/.../email-builder/block-preview.tsx:24` |
| SEC-09 | P2 | Dashboard يخزّن user كامل (email/phone/role) في localStorage — قابل للقراءة عبر XSS | `apps/dashboard/lib/api/auth.ts:60,158` |
| SEC-10 | P2 | `NEXT_PUBLIC_DEV_EMAIL` و `NEXT_PUBLIC_DEV_PASSWORD` معرّضة في next.config (فاضية في prod لكن الاسم خطر) | `apps/dashboard/next.config.mjs:55-56` |
| SEC-11 | P3 | `/api/v1/public/metrics` بلا مصادقة — يكشف stats للعملية + DB | `api/public/metrics.controller.ts` |
| SEC-12 | P3 | `lookup-user` يكشف وجود الحسابات (`{ exists, hasPassword, channel }`) | `modules/identity/lookup-user/lookup-user.handler.ts:21` |
| SEC-13 | P3 | Helmet default — لا CSP صريح ولا HSTS preload | `apps/backend/src/main.ts:28` |

✅ صفر SQL injection. ✅ صفر SSRF (كل fetchWithTimeout يضرب hosts ثابتة، branding URLs محصّنة بـ `BRANDING_ALLOWED_ASSET_HOSTS`).

---

## 3. Database & Data Integrity

✅ 11 migration متسلسلة، صفر red-flag names. ✅ Cascade صحيح في Finance (Restrict). ✅ Money columns موثّقة بـ `/// halalas` ومهاجرة. ✅ Soft-delete مطبّق على Client.

| ID | Sev | Issue | Location |
|---|---|---|---|
| DB-01 | P0 | **صفر سياسة data retention مكوّدة** — OtpCode/ActivityLog/Notification/SmsDelivery/PlatformEmailLog تتراكم بلا حد. مخالف PDPL. | apps/backend/src (لا cron موجود) |
| DB-02 | P1 | `pg_stat_statements` غير مفعّل + لا `log_min_duration_statement` — يستحيل ترصد slow queries | `docker/docker-compose.prod.yml` postgres service |
| DB-03 | P1 | `onDelete: Cascade` على `GroupEnrollment.bookingId/groupSessionId` و `ServiceBundleItem.bundleId` — حذف الحجز يطمس سجل التسجيلات | `prisma/schema/bookings.prisma:206,216` + `organization.prisma:478` |
| DB-04 | P2 | Money columns `Decimal(12,2)` لكن الإتفاقية integer halalas — الـ scale يسمح بكسور | كل عمود مالي |
| DB-05 | P2 | `Client.email` و `Client.phone` بلا unique constraint — Race condition في إنشاء العميل | `prisma/schema/people.prisma:34-76` |
| DB-06 | P2 | FK indexes ناقصة: `Invoice.branchId/employeeId`، `Payment.(status,createdAt)`، `Booking.branchId/serviceId` | finance + bookings prisma |
| DB-07 | P2 | Soft-deleted client ممكن يُحجز له: `findFirst({ where: { id } })` بدون `deletedAt: null` في ≥5 handlers | create-booking, create-bundle-booking, get-booking, ... |
| DB-08 | P2 | `Booking`/`Payment`/`Invoice` لا `deletedAt` — Hard delete على سجلات مالية يدمر audit trail | finance/bookings prisma |
| DB-09 | P2 | Backup محلي فقط — لا shipping لـ S3/B2/MinIO خارجي | `docker/scripts/backup.sh` |
| DB-10 | P3 | `Client.nationalId` غير unique، `Booking.bookingNumber` غير unique | people/bookings prisma |
| DB-11 | P3 | N+1 محتمل في `client-logout` (findMany ثم loop bcrypt+update) | `modules/identity/client-auth/client-logout.handler.ts:13-22` |

---

## 4. API & Business Logic

✅ Booking state machine صلب (`assertTransition` معتمد، 16 handler متحقق). ✅ Serializable isolation + `pg_advisory_xact_lock` لمنع double-booking. ✅ Webhook idempotency (`@@unique([provider, eventId])`). ✅ HMAC signature verification + إعادة جلب من Moyasar كمصدر سلطة. ✅ BullMQ retry exponential + bounded.

| ID | Sev | Issue | Location |
|---|---|---|---|
| API-01 | P2 | لا دعم تقويم هجري (صفر hits لـ `hijri/umalqura`) — أساسي لحجوزات الإرشاد الأسري السعودي | apps/backend/src |
| API-02 | P2 | ≥10 list endpoints بلا pagination (`take`/`skip`): employee-availability, list-employee-services, list-service-employees, fcm-tokens get-client-push-targets، ... | apps/backend/src/modules |
| API-03 | P3 | `setGlobalPrefix('api/v1')` بس بلا `enableVersioning(URI)` — أي breaking change يجبر bump كامل | `apps/backend/src/main.ts:41` |
| API-04 | P3 | `complete-booking` يستخدم `.toDecimalPlaces(2).toNumber()` للـ VAT بدل `toHalalas/computeVat` helpers | `complete-booking.handler.ts:56-57` |

---

## 5. Frontend / Dashboard

✅ صفر `<img>` raw (next/image only). ✅ socket.io-client و @xyflow/react مزالة كما هو موثّق. ✅ TanStack Query queryKey hygiene ممتاز. ✅ 54 `aria-label` على icon buttons.

| ID | Sev | Issue | Location |
|---|---|---|---|
| FE-01 | P1 | تخزين كامل user object (PII) في localStorage | `apps/dashboard/lib/api/auth.ts:60,158` |
| FE-02 | P1 | تعريض `NEXT_PUBLIC_DEV_PASSWORD` في bundle (فاضي في prod لكن الاسم خطر) | `apps/dashboard/next.config.mjs:55-56` |
| FE-03 | P2 | Cross-feature imports: `settings → zoom`, `settings → email-config`, `users → activity-log` | `components/features/settings/*`, `users/activity-log-tab.tsx` |
| FE-04 | P2 | 13 ملف feature يتجاوز 300 سطر؛ 3 hooks > 200 سطر | components/features + hooks/ |
| FE-05 | P2 | `productionBrowserSourceMaps` غير محدد صراحة | `next.config.mjs` |
| FE-06 | P3 | hardcoded `"SMTP مخصص"` خارج `t()` | `components/features/email-config/email-config-form.tsx:31` |

---

## 6. DevOps & Infra

✅ Backend/Dashboard/Website في Sentry. ✅ Containers تشتغل non-root (uid 1001). ✅ Prod compose: postgres/redis/minio mu exposed على host. ✅ Helmet + Throttler + express-rate-limit. ✅ صفر `.env` files committed.

| ID | Sev | Issue | Location |
|---|---|---|---|
| OPS-01 | P1 | صفر security scanning في CI (لا npm audit، لا Trivy، لا gitleaks، لا CodeQL) | `.github/workflows/ci.yml` |
| OPS-02 | P1 | `pnpm openapi:sync \|\| true` — يبتلع الفشل، لا drift gate على `openapi.json` | `.github/workflows/ci.yml:155` |
| OPS-03 | P1 | لا restore runbook، لا restore drill، لا `restore.sh` companion لـ `backup.sh` | `docs/operations/` |
| OPS-04 | P2 | `minio/minio:latest` و `minio/mc:latest` غير مثبّتين | docker-compose files |
| OPS-05 | P2 | Prod healthcheck يضرب `/health/live` (process only) — لا تكشف Redis/DB degradation | `docker-compose.prod.yml:131` |
| OPS-06 | P2 | Dashboard vitest coverage thresholds (statements 25 / branches 14) — فعلياً بلا gate | `apps/dashboard/vitest.config.ts:43-49` |
| OPS-07 | P2 | Website Sentry: لا `beforeSend` scrubber (الـ backend والـ dashboard فيهم) | `apps/website/sentry.*.config.ts` |
| OPS-08 | P2 | E2E `flows/` suite ما يشتغل nightly — CI يشغل smoke فقط | `.github/workflows/ci.yml` |
| OPS-09 | P3 | `runs-on: ubuntu-latest` غير مثبّت — pin إلى 24.04 | ci.yml |
| OPS-10 | P3 | تحذير console.warn تائه في dashboard | `apps/dashboard/hooks/use-intake-forms.ts:114` |

---

## 7. Testing

| Surface | Threshold | Status |
|---|---|---|
| Backend Jest | branches 65 / functions 70 / lines 85 / statements 85 | ✅ Reasonable |
| Dashboard Vitest | statements 25 / branches 14 / functions 25 / lines 25.5 | ❌ بلا gate فعلي |
| Website Vitest | غير محدد | ❌ مفقود |
| E2E Playwright | 30 spec، تغطية bookings + payments + login | ✅ موجودة، لكن يشتغل smoke فقط في CI |

---

## 8. Compliance — PDPL + ZATCA (الأخطر)

| ID | Sev | Issue | Impact |
|---|---|---|---|
| COMP-01 | **P0** | **ZATCA Phase 2 صفر** — لا QR/TLV، لا CSID/PCSID، لا XML UBL 2.1، لا XAdES signing، لا Fatoora integration | عقوبات هيئة الزكاة. أي business > 3M ر.س VAT في النطاق. |
| COMP-02 | **P0** | **PDPL Consent**: لا موافقة صريحة مخزّنة، لا `consentedAt`/`consentVersion` على Client | مخالف PDPL Art. 6 |
| COMP-03 | **P0** | **PDPL Data Subject Rights**: لا endpoints لـ access/portability/erasure-with-pseudonymization | مخالف PDPL Art. 4 |
| COMP-04 | **P0** | **PDPL Data Residency**: استضافة على Hetzner Germany بلا تصريح SDAIA لنقل البيانات خارج المملكة. لا DPIA، لا call-out في docs | مخالف PDPL Art. 29 |
| COMP-05 | P1 | لا آلية إبلاغ خرق بيانات (72 ساعة لـ SDAIA) | مخالف PDPL |
| COMP-06 | P1 | لا cron لتطبيق سياسات الاحتفاظ (data retention) | مخالف PDPL |

VAT 15% مطبّق صح في الـ booking handlers. لكن بدون ZATCA Phase 2 الفاتورة غير معترف بها قانونياً.

---

## 9. Operational Readiness

| Item | Status |
|---|---|
| Health endpoints (live/ready) | ✅ موجودة وتتفحص DB+Redis+Queue+MinIO |
| Sentry instrumentation | ✅ كل التطبيقات |
| Runbooks (restore/incident/rollback) | ❌ مفقود — فقط `sawa-single-company.md` و `DOKPLOY-SETUP.md` |
| On-call rotation | ❌ غير موثّقة |
| SLA/SLO | ❌ غير موثّقة |
| Status page | ❌ غير موجودة |
| Customer onboarding doc | ❌ غير موجود |

---

## 10. Top Priority Fix Plan (الترتيب الموصى به)

### Sprint 1 — الحرج (Blockers قبل أي إنتاج)
1. **COMP-04** — قرار استضافة: SDAIA cross-border approval أو migrate إلى STC Cloud / AWS Bahrain / SaudiCloud. **هذا قرار تنفيذي، ليس مهمة كود.**
2. **COMP-01** — ZATCA Phase 2 (QR + XML signing + clearance). أسبوع-أسبوعين عمل.
3. **COMP-02/03** — جدول Consent + endpoints DSR (access/erasure/portability).
4. **DB-01 + COMP-06** — Data retention cron + سياسة موثّقة.

### Sprint 2 — الأمن العالي (هذا الـ PR)
5. SEC-01: bcrypt cost → 12
6. SEC-02: `OWNER_EMAILS` في Joi schema
7. SEC-03: login lockout atomic update
8. SEC-04: ownership check على presigned URLs
9. FE-01: تنظيف localStorage من PII
10. FE-02: إعادة تسمية `NEXT_PUBLIC_DEV_PASSWORD`
11. OPS-01: security scanning في CI
12. OPS-02: openapi drift gate
13. OPS-04: تثبيت minio tags

### Sprint 3 — Hardening المتوسط
- DB-03: Cascade → Restrict على enrollment/bundle items
- DB-05: Partial unique على Client.email/phone
- DB-06: indexes الناقصة
- DB-07: filter بـ `deletedAt: null` في handlers الحجز
- OPS-03: restore runbook + drill
- OPS-05: prod healthcheck لـ `/health/ready`
- OPS-06: dashboard vitest thresholds

---

## Summary by Severity

- **6 P0** — كلها امتثال (ZATCA + PDPL). بدون معالجة هذي، أي إطلاق إنتاجي مخاطرة قانونية.
- **10 P1** — معظمها قابل للإصلاح في 1-2 أيام عمل.
- **28 P2 / 14 P3** — تحسينات صحية.

**القرار**: لا تطلق على عميل دافع قبل معالجة P0s. الكود نفسه (الأمن، البنية، اختبار، الـ business logic) في حالة ممتازة وقريب من production-ready.
