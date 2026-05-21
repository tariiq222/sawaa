# Sawa — تقرير التدقيق الشامل (كل المنصة)

**التاريخ:** 2026-05-21
**النطاق:** كل الـ monorepo — backend + dashboard + website + mobile + packages + CI/CD/infra
**النوع:** Audit/Investigation فقط — بدون أي تعديل في الكود
**عدد الـ Sub-Agents:** 12 فرقة بالتوازي (8 للداشبورد سابقاً + 4 جديدة)

---

## 1. القرار النهائي بمستوى كل سطح

| السطح | Confidence | الحالة | BLOCKERs |
|---|---|---|---|
| **Backend** | 82/100 | READY with minor gaps | 1 (pgvector injection check) |
| **Dashboard** | 81/100 | READY WITH RISKS (تم إصلاح أكثرها) | 0 متبقية بعد الجلسة السابقة |
| **Website (موقع)** | **72/100** | **NOT READY — Do NOT Deploy** | 3 (open redirect ×2 + race condition) |
| **Mobile** | 82/100 | READY WITH RISKS | 1 (typecheck يفشل) |
| **Packages + Infra + CI** | 86/100 | PRODUCTION-READY مع 3 BLOCKERs | 3 (api-client untested + no Zod + smoke non-blocking) |
| **الإجمالي** | **~80/100** | يحتاج 2-3 أيام لإغلاق الـ BLOCKERs قبل الإطلاق العام | **8 BLOCKERs منصبّة على Website + Infra** |

**القرار الكلّي:** الداشبورد + الموبايل + الباك إند قابلة للنشر تقريباً بعد إصلاحات صغيرة. **الموقع العام (website) هو نقطة الخطر الأكبر** — فيه open redirects + slot race condition تمنع التسليم. الـ infra/api-client/CI فيها فجوات اختبار يجب إغلاقها.

---

## 2. BLOCKERs الجديدة المكتشفة (لم تكن في تدقيق الداشبورد)

### Website (3 BLOCKERs قاتلة)

| # | الـ BLOCKER | الملف | الخطر | الإصلاح |
|---|---|---|---|---|
| W1 | **Open Redirect في صفحة الدفع** | [payment-redirect.tsx:21](apps/website/src/features/payment/payment-redirect.tsx#L21) | `window.location.href = redirectUrl` بدون فحص نطاق — المهاجم يحوّل العميل لبوابة دفع مزيفة → سرقة بطاقات | فحص نطاق Moyasar (30 دقيقة) |
| W2 | **Open Redirect بعد تسجيل الدخول** | [login-form.tsx:49-53](apps/website/src/features/auth/login-form.tsx#L49-L53) | `router.push(redirectTo)` بدون validation — `/login?redirect=https://evil.com` → phishing بعد تسجيل دخول حقيقي | whitelist للمسارات الداخلية فقط (30 دقيقة) |
| W3 | **Slot Race Condition في الحجز** | [booking/page.tsx:280-290](apps/website/src/app/booking/page.tsx#L280-L290) | المستخدم يتأخر بـ OTP، الـ slot يتحجز من شخص ثاني، الـ FE ما يلتقط 409/422 → فشل صامت | catch 409 + reset لـ slot picker (1 ساعة) |

### Mobile (1 BLOCKER)

| # | الـ BLOCKER | الموقع | الإصلاح |
|---|---|---|---|
| M1 | typecheck يفشل (implicit `any` في callbacks) | tsconfig + عدة ملفات | pnpm install + typecheck + إصلاح أنواع callbacks |

### Backend (1 BLOCKER محتمل + تأكيد لازم)

| # | الـ BLOCKER | الملف | الإصلاح |
|---|---|---|---|
| B-AI1 | pgvector semantic search يستخدم `$queryRawUnsafe` — يحتاج تأكيد إن topK مفلتر | [semantic-search.handler.ts](apps/backend/src/modules/ai/semantic-search/semantic-search.handler.ts) | مراجعة الـ query وضمان أن topK رقم محدود [1, 100] فقط، ولا في user input في الـ literal |

### Infra/Packages (3 BLOCKERs)

| # | الـ BLOCKER | الموقع | الخطر | الإصلاح |
|---|---|---|---|---|
| I1 | **api-client بدون اختبارات** — 30 من 33 module بدون تيستات | `packages/api-client/src/modules/__tests__/` | لو الـ backend غيّر DTO، الـ FE يتعطّل صامتاً | إضافة vitest لأهم 10 modules (bookings/payments/services/clients...) — 4 ساعات |
| I2 | **shared بدون Zod schemas** | `packages/shared/schemas/` غير موجود | drift بين backend Zod و frontend TS types | mirror backend Zod في shared + validation في api-client — 6 ساعات |
| I3 | **dashboard-smoke غير ملزم في CI** | `.github/workflows/ci.yml` | يفشل بدون منع الـ merge | إضافة required status check — 30 دقيقة |

---

## 3. CRITICALs المكتشفة (يفضّل قبل الإطلاق)

### Backend
- **C-BE1**: webhook endpoints بدون @Throttle خاص — Moyasar+SMS webhook عرضة لـ amplification
- **C-BE2**: OTP session token بدون expiration — قابل لإعادة الاستخدام
- **C-BE3**: audit log ما يلتقط cron mutations (booking expiry/refund reconciliation)

### Website
- **C-WS1**: OTP token مخزّن في module-level mutable variable — يضيع عند refresh + ليس httpOnly
- **C-WS2**: form بدون required/regex (phone KSA format) — submissions فارغة تصل للـ backend
- **C-WS3**: CSS injection محتملة عبر branding `dangerouslySetInnerHTML` — مطلوب escape

### Mobile
- **C-MO1**: نصوص عربية hardcoded خارج i18n (login.tsx:184) — تنكسر عند تبديل اللغة
- **C-MO2**: ScrollView على قوائم طويلة (appointments/records) — مفروض FlatList
- **C-MO3**: لا fallback عند فشل network — قائمة فاضية بدون retry button
- **C-MO4**: الحجز يُنشأ **قبل** الدفع (booking/payment.tsx:67) — حجوزات مهجورة تتراكم

### Infra
- **C-IN1**: dashboard CI لا يعمل typecheck صريح لـ @sawaa/api-client و @sawaa/ui — أخطاء type تمر
- **C-IN2**: state machines في shared بدون tests (booking-wizard)
- **C-IN3**: لا container image scanning في CI (Trivy/Snyk)

---

## 4. HIGH (لا تمنع التسليم لكن مهمة)

**Backend:**
- SMS provider creds: تأكيد AAD = DEFAULT_ORG_ID في كل decrypt paths
- Zoom credential rekey TODO (P2.B) يحتاج تدخل يدوي قبل الإنتاج
- E2E tests على Prisma mock — مش DB حقيقي → race conditions غير مغطاة

**Website:**
- لا open graph tags للمشاركة على السوشال
- `/therapists` بدون ISR — SSR كل request
- لا error boundary للقواعد الفاشلة
- بعض aria labels ناقصة

**Mobile:**
- لا unregister للـ FCM token عند logout — token يبقى على الـ server
- بعض image permissions تفشل بصمت
- Sentry sampling 10% — 90% errors مش ملتقطة

**Infra:**
- Turbo cache skipped للـ shared build (manual tsc)
- لا OpenAPI drift detection بين commits
- لا pre-commit hooks (husky/lint-staged)

---

## 5. التوصيات السريعة (مرتبة بالأولوية والوقت)

### اليوم 1 — Website BLOCKERs (الأهم — 2 ساعة)

```ts
// W1: payment-redirect.tsx
const MOYASAR_DOMAINS = ['moyasar.com', 'api.moyasar.com', 'inv.moyasar.com'];
const url = new URL(redirectUrl);
if (!MOYASAR_DOMAINS.includes(url.hostname)) throw new Error('Invalid redirect');
window.location.href = redirectUrl;

// W2: login-form.tsx
const SAFE_PATH = /^\/(?!\/)[\w\-/?#&=.%]+$/;
const target = (redirectTo && SAFE_PATH.test(redirectTo)) ? redirectTo : '/account';

// W3: booking/page.tsx
try { await createGuestBooking(...) }
catch (e) {
  if (e.status === 409) { toast.error('السلوت محجوز'); resetToSlotPicker(); }
}
```

### اليوم 1 — Mobile typecheck (1 ساعة)

```bash
pnpm --dir apps/mobile install
pnpm --dir apps/mobile typecheck  # capture errors
# أضف types صريحة على الـ callbacks في الـ FlatList renderItem + onChangeText
```

### اليوم 2 — Infrastructure (يوم كامل)

- إضافة vitest لـ 10 api-client modules (bookings/payments/services/clients/employees/groups/ratings/invoices/coupons/availability)
- إنشاء `packages/shared/schemas/` مع Zod mirrors
- جعل dashboard-smoke required في GitHub branch protection
- مراجعة semantic-search.handler.ts للتأكد من sanitization

### اليوم 3 — CRITICALs الباقية + smoke

- إصلاح OTP token storage في website (sessionStorage + TTL warning)
- form validation في website (required + KSA phone regex)
- نقل booking creation في mobile لـ post-payment
- إضافة @Throttle لـ webhook endpoints في backend
- نصوص عربية الـ mobile لـ i18n
- staging deploy + smoke كامل

---

## 6. ما هو سليم وممتاز عبر المنصة

### Backend ✅
- Booking state machine: 18 transitions، pg_advisory locks، Serializable transactions
- Moyasar webhook: HMAC timing-safe + idempotency + re-fetch authoritative + amount/currency validation
- Auth: JWT token versioning + OTP lockout + refresh rotation + separate client namespace
- Money halalas Decimal(12,2) + VAT pure Decimal + CHECK constraints على commission
- Encryption AES-256-GCM + HKDF-SHA256 key derivation متّسقة عبر Moyasar/SMS/Zoom/Email
- BullMQ retry policies + outbox publisher + advisory-lock cron leader election

### Dashboard ✅ (بعد الجلسة السابقة)
- Approve/reject cancel mutations موصولة كاملة
- Zoom delete errors logged + DLQ-ready
- SMS DLR idempotency dedup
- newClientsToday filter deletedAt
- api-client PaymentStatus + PaymentStats مطابقة backend
- Atomic Moyasar credentials rotation guard
- typecheck/lint/i18n/openapi نظيفة

### Mobile ✅
- Auth flow ممتاز: OTP login + Secure Store + auto-refresh + token rotation
- RTL handling شامل (DirState، writingDirection، iconScaleX)
- Sentry + error boundary
- Push notifications مع deep linking
- No `any` types، no hardcoded colors، file size limits مراعاة

### Website ✅
- TypeScript strict
- httpOnly cookies للـ client auth
- Sitemap + robots + JSON-LD structured data
- Image optimization (next/image, avif/webp)
- Branding fetched مع ISR 60s
- RTL/i18n logical CSS

### Infra ✅
- Multi-stage Dockerfile + non-root user
- Health checks لكل service في docker-compose
- pnpm-workspace قواعد واضحة (mobile خارج بقصد)
- .env.example شامل وآمن (placeholders فقط، لا secrets حقيقية)
- CODEMAP + CLAUDE.md لكل package
- Migration drift CI

---

## 7. المسؤولية بحسب الفريق

| الفريق | المهام البلوكر |
|---|---|
| **Frontend (Website)** | W1+W2+W3 (open redirects + slot race) — أولوية قصوى |
| **Mobile** | M1 typecheck + i18n cleanup + FlatList migration |
| **Backend** | B-AI1 semantic search review + audit log في crons + webhook throttling |
| **Infra/Platform** | I1+I2+I3 — api-client tests + Zod schemas + CI gates |

---

## 8. خلاصة بسطرين

1. **الداشبورد + الموبايل + الباك إند:** جاهزة تقريباً للإطلاق، تحتاج إصلاحات صغيرة موزّعة (يوم عمل واحد).
2. **الموقع العام (website):** **لا تطلقه** قبل إصلاح 3 BLOCKERs (open redirects + slot race). الـ infra/api-client/CI تحتاج فجوات اختبار يجب إغلاقها بالتوازي.

**الوقت التقديري قبل go-live آمن:** 2-3 أيام عمل موزّعة على 3 فرق متوازية.
