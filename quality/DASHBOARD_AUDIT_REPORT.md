# Sawa Dashboard — تقرير تدقيق ما قبل التسليم

**التاريخ:** 2026-05-21
**النطاق:** apps/dashboard + الـ APIs والقاعدة المرتبطة به فقط
**النوع:** Audit/Investigation/Verification (بدون أي تعديل في الكود)
**عدد الـ Sub-Agents:** 8 فرق متخصصة بالتوازي

---

## 1. القرار النهائي

**READY WITH RISKS** — قابل للتسليم بعد إصلاح 6 نقاط حرجة فقط (تقدير: 1–2 يوم عمل).

- typecheck: ✅ نظيف على كل الـ packages
- lint: ✅ صفر errors (94 warnings ضعيفة)
- البنية: ناضجة، state machine للحجوزات سليم، money بالـ halalas مهاجَر، الأمن backend-enforced
- الفجوات: 4 BLOCKERs UX/Integration + 2 خلل بيانات صغير في الداشبورد

---

## 2. درجات الثقة لكل محور

| المحور | Confidence | الحالة |
|---|---|---|
| Scope discovery | 94/100 | كامل |
| Booking flow | 87/100 | جاهز، 2 wiring ناقص |
| Auth & Security | 85/100 | قوي backend، فجوات صغيرة |
| API contract | 72/100 | drift في api-client |
| DB integrity | 78/100 | event-driven FK risk |
| UI/UX | 78/100 | dirty-state + reset gaps |
| Integrations | 70/100 | Zoom/SMS/Invoice gaps |
| Test/Release | 82/100 | core مغطى، 7 features بدون e2e |
| **الإجمالي** | **81/100** | READY WITH RISKS |

---

## 3. BLOCKERs (إصلاح إجباري قبل التسليم)

| # | المشكلة | الملف | المخاطرة | الإصلاح |
|---|---|---|---|---|
| B1 | Approve/Reject cancel mutations مش موصولة في الـ FE (الـ dialogs ترمي error generic) | [booking-actions.tsx:207-226](apps/dashboard/components/features/bookings/booking-actions.tsx#L207-L226) | الموظف ما يقدر يوافق/يرفض طلبات الإلغاء | ربط `approveCancelMut` و `rejectCancelMut` بالمطّيرات الموجودة في الـ hooks |
| B2 | Zoom meeting deletion يبتلع الأخطاء بصمت `.catch(() => {})` | [cancel-booking.handler.ts:141-143](apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.ts#L141-L143) | الحجز يتلغى لكن الميتنق يبقى على Zoom — confusion للعميل والموظف | log explicit + DLQ للـ retry اليدوي |
| B3 | SMS DLR webhook بدون idempotency dedup | [sms-dlr.handler.ts:85-94](apps/backend/src/modules/comms/sms-dlr/sms-dlr.handler.ts#L85-L94) | تكرار webhook يقلّب الـ status ذهاب وإياب | إضافة WebhookEvent dedup على `providerMessageId:status` (نفس نمط Moyasar) |
| B4 | Invoice PDF download + email resend مفقودة من الداشبورد | [invoice-list-page.tsx](apps/dashboard/components/features/invoices/invoice-list-page.tsx) | الموظف ما يقدر يعطي العميل فاتورة أو يعيد إرسالها | إضافة detail sheet + download + resend |
| B5 | Email delivery log مفقود من الداشبورد (SMS موجود فقط) | لا يوجد مكون | الموظف ما يقدر يعرف ليش الإيميل ما وصل | نسخ نفس نمط SMS log للإيميل |
| B6 | Dashboard `newClientsToday` ما يفلتر `deletedAt` | [get-dashboard-stats.handler.ts:78-79](apps/backend/src/modules/dashboard/get-dashboard-stats/get-dashboard-stats.handler.ts#L78) | إحصائيات العملاء الجدد متضخمة بالمحذوفين | إضافة `where: { deletedAt: null }` |

---

## 4. CRITICALs (يفضّل قبل التسليم — يوم واحد)

| # | المشكلة | الملف | الإصلاح |
|---|---|---|---|
| C1 | `PaymentStatus` enum mismatch بين api-client و backend (lower vs UPPER) | [payment.ts:5-11](packages/api-client/src/types/payment.ts#L5-L11) | تصحيح القيم لتطابق Prisma enum |
| C2 | `PaymentStats` shape mismatch (api-client فيه 6 fields، backend يرجع 11) | [payment.ts:57-63](packages/api-client/src/types/payment.ts#L57-L63) | تحديث الـ type ليطابق |
| C3 | User payload في localStorage plain JSON — XSS يقدر يقراه | [auth.ts:60](apps/dashboard/lib/api/auth.ts) | إزالته أو hydrate من `/auth/me` |
| C4 | Payment mutations بدون `idempotencyKey` من الـ FE (الـ BE يدعمها) | [use-payments.ts](apps/dashboard/hooks/use-payments.ts) | UUID generation عند submit |
| C5 | Moyasar credential rotation مش atomic — ممكن جزء يُحفظ ويفشل تست | [settings-payment-tab.tsx:47-67](apps/dashboard/components/features/settings/settings-payment-tab.tsx#L47-L67) | all-or-nothing داخل transaction |
| C6 | Client form ما يعمل reset بعد success → خطر دبل سبمت | [client-form.tsx](apps/dashboard/components/features/clients/client-form.tsx) | استدعاء `form.reset()` بعد toast.success |
| C7 | Migration 20260520150000 فيها 9 UPDATEs متسلسلة بدون transaction واضح | [finalize_delivery_type_transition](apps/backend/prisma/migrations/) | جرّب staging dry-run قبل prod |

---

## 5. HIGH (مهم لكن مش مانع تسليم)

- Reschedule action مش موجود في dropdown — متاح فقط في detail tab
- No dirty-state guard على الـ forms (المستخدم يفقد البيانات لو ضغط back)
- Refund status history مش ظاهر في الداشبورد
- General dashboard endpoints بدون rate limiting (auth-only منها throttled)
- Client.nationalId مخزّن بدون encryption
- Cross-BC FKs event-driven بدون schema enforcement — orphan risk
- Invoice ↔ Payment totals بدون CHECK constraint للموازنة
- Invoice.vatRate بدون CHECK `BETWEEN 0 AND 1`
- 7 features بدون e2e: branches, coupons, bundles, chatbot, intake-forms, SMS config, activity-log
- Playwright smoke في CI ما يمنع merge (advisory فقط)
- openapi.json ناقصه response schemas لكل الـ list endpoints

---

## 6. MEDIUM (تحسينات بعد الإطلاق)

- walk-in form step indicator مش responsive على شاشات صغيرة
- RTL violation واحد: `text-right` في [waitlist-tab.tsx:70](apps/dashboard/components/features/bookings/waitlist-tab.tsx#L70)
- Blood type "UNKNOWN" hardcoded عربي بدل `getBloodLabels(t)`
- Refresh token cookie بدون `maxAge` لو `rememberMe=false`
- Password reset token TTL 30 دقيقة — يفضّل 10-15
- BookingStatusLog ما يلتقط reschedule/notes/price changes
- No calendar view (month/week/day) — قائمة فقط
- 403 denials ما تنحفظ في audit log
- File.isDeleted soft-delete مش محترم في queries
- No browser multi-target في Playwright (Chrome فقط)
- Reports عندها smoke test واحد بس

---

## 7. ما هو سليم وجاهز

- ✅ State machine للحجوزات: 18 transition، assertTransition يمنع كل invalid، 4 terminal states محمية
- ✅ Double-booking prevention: pg_advisory_xact_lock + Serializable transactions
- ✅ Timezone Asia/Riyadh: UTC↔Riyadh conversion عند الحدود فقط (آخر commit `9ecc74e`)
- ✅ Group capacity rollback صحيح، coupon usage يتعدّل عند cancel
- ✅ Money halalas Decimal(12,2) في كل النماذج المالية + commission rate CHECK
- ✅ Moyasar webhook: HMAC timing-safe + idempotency على `paymentId:status` + PERMANENT/TRANSIENT classification
- ✅ Auth: access token in-memory، refresh httpOnly rotation، CASL guard على كل endpoint
- ✅ Encryption AES-256-GCM لكل provider creds (Moyasar, SMS, Zoom, Email)
- ✅ Rate limit شامل على كل /auth/* + OTP بطبقتين (per-IP + per-identifier)
- ✅ Pagination + filters + loading/empty/error states منتشرة بشكل متّسق
- ✅ RTL foundation قوي، sidebar direction-aware، logical spacing مستعمل
- ✅ typecheck + lint كلاهما passes
- ✅ 24 e2e spec للداشبورد + 6 backend e2e suites + 141 unit dashboard + 636 unit backend
- ✅ Indexes تغطي hot query patterns (employeeId+scheduledAt، gatewayRef، إلخ)

---

## 8. خطة تنفيذ مقترحة

**اليوم 1 (BLOCKERs):**
- B1: ربط approve/reject mutations (1-2h)
- B6: إضافة deletedAt filter (10min)
- C6: form reset بعد submit (30min)
- B2: log Zoom delete errors + DLQ (2h)
- B3: SMS DLR idempotency table (3h)

**اليوم 2 (BLOCKERs + CRITICALs):**
- B4: invoice detail sheet + download + email resend (4h)
- B5: email delivery log component (3h)
- C1+C2: تصحيح api-client types (1h)
- C5: atomic Moyasar credentials (2h)

**يوم 3 (smoke + verification):**
- staging deploy
- يدوي: login لكل دور، حجز فردي، حجز متكرر، إلغاء بـ refund، تغيير SMS config، رفع KB chatbot
- e2e كامل مع `pnpm --filter=dashboard run e2e`
- مراقبة Sentry/GlitchTip لأول 24 ساعة

---

## 9. ملفات تحتاج تعديل (قائمة موحّدة)

1. [apps/dashboard/components/features/bookings/booking-actions.tsx](apps/dashboard/components/features/bookings/booking-actions.tsx) — B1
2. [apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.ts](apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.ts) — B2
3. [apps/backend/src/modules/comms/sms-dlr/sms-dlr.handler.ts](apps/backend/src/modules/comms/sms-dlr/sms-dlr.handler.ts) — B3
4. [apps/dashboard/components/features/invoices/](apps/dashboard/components/features/invoices/) — B4 (إضافة detail-sheet)
5. [apps/dashboard/components/features/settings/](apps/dashboard/components/features/settings/) — B5 (email-delivery-log-table)
6. [apps/backend/src/modules/dashboard/get-dashboard-stats/get-dashboard-stats.handler.ts](apps/backend/src/modules/dashboard/get-dashboard-stats/get-dashboard-stats.handler.ts) — B6
7. [packages/api-client/src/types/payment.ts](packages/api-client/src/types/payment.ts) — C1+C2
8. [apps/dashboard/lib/api/auth.ts](apps/dashboard/lib/api/auth.ts) — C3
9. [apps/dashboard/hooks/use-payments.ts](apps/dashboard/hooks/use-payments.ts) — C4
10. [apps/dashboard/components/features/settings/settings-payment-tab.tsx](apps/dashboard/components/features/settings/settings-payment-tab.tsx) — C5
11. [apps/dashboard/components/features/clients/client-form.tsx](apps/dashboard/components/features/clients/client-form.tsx) — C6

---

## 10. خلاصة بسطر واحد

الداشبورد جاهز للتسليم بعد إصلاح 6 BLOCKERs (تقدير يومين). الـ core (bookings, auth, payments, money) ناضج ومحمي. الفجوات في UX/integrations دون مستوى ship-stopper لكن إصلاحها يرفع التقييم من 81 إلى 92+.
