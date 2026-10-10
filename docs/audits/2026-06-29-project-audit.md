I have enough grounding from the raw findings (which already carry verified file:line references) and the one P0 confirmation above. Producing the report now.

# تقرير التدقيق التنفيذي — منصة Sawaa
**التاريخ:** 2026-06-29 · **النطاق:** تدقيق 50-وكيل عبر 8 أبعاد · **المُركِّب:** كبير المدققين

---

## 1. الملخص التنفيذي

القاعدة البرمجية في حالة **جيدة إلى قوية بشكل عام**: المعمارية (modular monolith + vertical slices) منضبطة، رياضيات المال (VAT/halalas) صحيحة ومُوحَّدة، طبقة المصادقة والتشفير وأمن الـ webhook مبنية بعناية دفاعية ممتازة، وضبط التزامن في الحجوزات والمدفوعات (advisory locks + Serializable + DB exclusion constraint) متين. **عيب P0 واحد فقط** مؤكَّد: مسار "الموافقة على إلغاء الحجز" من الداشبورد يُنشئ طلب استرداد عالقاً للأبد ولا يُعيد المال أبداً. تتركّز المخاطر الحقيقية المتبقية في **حواف غير-سعيدة في تدفقات المال** (استرداد off-gateway، استرداد باقة جزئي يمحو الأرصدة، كوبونات متراكمة تتجاوز المبلغ) و**انحراف UI-vs-enforcement في الصلاحيات** و**عيوب وظيفية في تطبيق الموبايل** (شاشة نجاح كاذبة عند إلغاء الدفع). الأخطاء المؤجَّلة لـ VA>0 غير حيّة اليوم لأن المركز غير مسجّل ضريبياً (VAT=0)، لكنها قنابل موقوتة عند أي تسجيل ضريبي مستقبلي.

---

## 2. الأولوية القصوى: P0 / P1 (سجل التراكم الحرج)

### 🔴 P0 — يُعالَج فوراً

| # | العيب | الموقع | الإصلاح |
|---|---|---|---|
| **P0-1** | **الموافقة على إلغاء حجز تُنشئ RefundRequest في PROCESSING لكن لا تُرسل لـ Moyasar أبداً — المال لا يُعاد ولا يستطيع cron إنقاذه** (لا مشترك يستمع لـ `bookings.booking.cancel_approved`؛ المُنقذ يستمع لحدث مختلف؛ reconcile-refunds يفلتر `gatewayRef != null` فلا يرى الصف). owner-only/payments. | `approve-cancel-booking.handler.ts:110-151` → `booking-cancel-approved.event.ts:23` | أضف مشتركاً لـ `bookings.booking.cancel_approved` يستدعي `refund.finalizeRefundFromCancellation({refundRequestId, idempotencyKey})` (نفس مسار حدث cancelled). أضف اختباراً يؤكد استدعاء `Moyasar.createRefund` ووصول الطلب لـ COMPLETED. **يشمل أيضاً مدفوعات off-gateway المعتمدة عبر هذا المسار.** |

### 🟠 P1 — أولوية عالية

**المدفوعات والاسترداد (owner-only — تتطلب Moyasar sandbox + dashboard smoke):**

| # | العيب | الموقع | الإصلاح |
|---|---|---|---|
| P1-1 | إلغاء حجز مدفوع off-gateway (نقد/تحويل) يُجهض المعاملة كلها (الاسترداد بلا gatewayRef يرمي داخل tx) | `cancel-booking.handler.ts:76-143` → `refund-payment.handler.ts:203-205` | فرّع على وجود gatewayRef؛ سجّل الاسترداد عبر المسار اليدوي (no-Moyasar ledger) داخل نفس tx بحيث ينجح الإلغاء دائماً |
| P1-2 | استرداد باقة جزئي يمحو **كل** أرصدة الباقة (يدمّر الجلسات المدفوعة المتبقية) | `refund-package-purchase.handler.ts:105-109` | إمّا رفض الاسترداد الجزئي (`refundAmount === amountPaid`) أو إبطال الأرصدة غير المستهلكة فقط وإبقاء الباقة ACTIVE |
| P1-3 | استرداد باقة يدوي بلا قفل صف — طلبان متزامنان = استرداد مزدوج (المسار الوحيد بلا FOR UPDATE + clamp + in-flight guard) | `refund-package-purchase.handler.ts:67-200` | انقل حارس الحالة داخل tx كـ `updateMany WHERE status != REFUNDED`؛ اقفل صف Payment بـ FOR UPDATE و clamp للرصيد القائم |
| P1-4 | تكرار حرفي لمنطق G3 reconciliation بين init-client-payment و init-package-purchase (انحراف = شحن مزدوج) | `init-client-payment.handler.ts:79-118` و `init-package-purchase.handler.ts:216-256` | استخرج `reconcileOrDiscardInFlightPayment()` مشتركاً |

**الكوبونات والخصم:**

| # | العيب | الموقع | الإصلاح |
|---|---|---|---|
| P1-5 | كوبونات متراكمة تدفع discountAmt **فوق** subtotal (صف فاتورة غير متسق) | `apply-coupon.handler.ts:102-116` | `Decimal.min(invoiceDiscountAmt.plus(d), invoiceSubtotal)` + ضبط redemption rows |
| P1-6 | خصم يدوي يكتب فوق خصم الكوبون لكن يترك CouponRedemption + usedCount يتيمين (دلالة معتمدة على الترتيب) | `apply-invoice-discount.handler.ts:124-135` | اعتمد نموذجاً واحداً: ارفض الخصم اليدوي عند وجود redemptions، أو عكّس الصفوف وأنقص usedCount في نفس tx |

**المصادقة والصلاحيات (owner-only):**

| # | العيب | الموقع | الإصلاح |
|---|---|---|---|
| P1-7 | **client tokenVersion لا يُمرَّر للتوكنات المُصدَرة — إعادة تعيين كلمة المرور تقفل العميل خارج الدخول** (reset يرفع لـ 1، الدخول يصدر 0، الـ strategy ترفض) | `client-token.service.ts:57` (callers: client-login:105, client-refresh:51, register:94) | حمّل tokenVersion الحي ومرّره من المسارات الثلاثة؛ اختبار: reset → login → endpoint مُصادق = 200 |
| P1-8 | قائمة صلاحيات الداشبورد تتجاهل تعديلات system-role في DB (UI vs enforcement) → أزرار ميتة أو ميزات مخفية مسموحة | `auth-response.builder.ts:52`، `auth.controller.ts:242`، `verify-dashboard-otp.handler.ts:164` | مرّر `systemRolePermissions` لـ `flattenPermissions` كما تفعل JwtStrategy في login/me/dashboard-OTP |
| P1-9 | REJECT_CANCEL يرفع حجوزات unpaid/deposit-only لـ CONFIRMED متجاوزاً الدفع | `booking-state-machine.ts:185-188` | استعد الحالة قبل-الطلب (من BookingStatusLog.fromStatus) بدل فرض CONFIRMED؛ صحّح spec:112 |

**المصادقة (الموبايل/الـ OTP):**

| # | العيب | الموقع | الإصلاح |
|---|---|---|---|
| P1-10 | mobile OTP verify يستهلك الكود بـ update غير ذرّي (سباق double-consume + إصدار توكن مزدوج) | `verify-mobile-otp.handler.ts:96` | استبدل بـ `updateMany({where:{id, consumedAt:null, expiresAt:{gt:now}}})` + تحقق count===0 |

**الإشعارات الحرجة:**

| # | العيب | الموقع | الإصلاح |
|---|---|---|---|
| P1-11 | الإشعارات الحرجة (push) لا تُعاد أبداً وتُسجَّل SENT دائماً (SendPushHandler يبتلع كل أخطاء FCM؛ آلية retry ميتة) | `send-push.handler.ts:16-21` | اجعل المسار يطفو الفشل للـ dispatcher (rethrow أو استدعاء FcmService مباشرة)؛ اختبار: كل التوكنات ترفض → FAILED + retry مُجدول |
| P1-12 | حدث payment-completed يُنشَر خارج tx بلا outbox؛ reconcile cron لا يستطيع الإنقاذ (الدفع COMPLETED لكن الحجز غير مؤكَّد، لا إيصال) | `moyasar-webhook.handler.ts:465-487`؛ `reconcile-payments.cron.ts:244-267` | اكتب الأحداث لـ OutboxEvent داخل نفس tx (كما يفعل create-booking) ودع OutboxPublisherCron ينشرها |
| P1-13 | jobs الـ domain-events/event-bus تعمل بـ attempts=1 — المعالجات الفاشلة لا تُعاد رغم عقد at-least-once | `event-bus.service.ts:56-65,101-128` | اضبط attempts + backoff على jobs أحداث النطاق (أو defaultJobOptions على Queue) |
| P1-14 | DEFAULT_JOB_OPTIONS (خيارات job) تُمرَّر لـ Worker حيث تُتجاهَل بصمت (السبب الجذري لـ P1-13) | `bull-mq.service.ts:6-20,74-79` | انقلها لـ `new Queue(name, { defaultJobOptions })`؛ أبقِ على concurrency/maxStalledCount فقط على Worker |

**البنية/العقود/الأداء:**

| # | العيب | الموقع | الإصلاح |
|---|---|---|---|
| P1-15 | api-client BookingStatus union ينقصه `deposit_paid` (انحراف نوع حقيقي مع backend enum الحي) | `packages/api-client/src/types/booking.ts:3-13` | أضف `deposit_paid` |
| P1-16 | لا بوابة drift آلية لـ api-client المكتوب يدوياً ضد OpenAPI (السبب الجذري لـ P1-15) | `package.json:23` + `api-client/types/*` | بوابة CI تقارن unions/DTOs بـ openapi.json |
| P1-17 | فهرس pgvector ANN لا يُنشأ في الإنتاج — البحث الدلالي seq-scan (الـ hook غير مُستدعى في Dockerfile CMD) | `Dockerfile:150` vs `ensure_vector_indexes.sql:11` | اجعل فهرس ivfflat/hnsw مهاجرة SQL حقيقية بدل hook جانبي |
| P1-18 | delete-employee يُيتّم صفوف ServiceDurationOption/EmployeeServiceOption المملوكة للممارس (نفس فئة عيب الإنتاج السابق) | `delete-employee.handler.ts:107` | احذف الصفوف عبر esIds داخل tns قبل cascade؛ اختبار regression |
| P1-19 | شريط تواريخ التوفر يشغّل check-availability تسلسلياً لكل يوم (N×pipeline، أغلبه مكرّر) على endpoint عام ساخن | `get-public-availability-days.handler.ts:62-78` | quick: `Promise.all`؛ proper: ارفع الـ lookups الثابتة خارج الحلقة + جلب حجوزات النافذة كاملة بطلب واحد |
| P1-20 | كتالوج الباقات العام موثَّق كـ cacheable لكن بلا cache (إعادة حساب على كل طلب عام) | `list-public-packages.handler.ts:27-50` | `cache.getOrSet('ref:public-packages', loader, 300)` + invalidation |

**الموبايل/الموقع (وظيفي):**

| # | العيب | الموقع | الإصلاح |
|---|---|---|---|
| P1-21 | شاشة نجاح الموبايل تُبلّغ بالنجاح حتى عند إلغاء/فشل الدفع (نتيجة WebBrowser غير مفحوصة) | `payment.tsx:106-123`، `success.tsx:154-173` | افحص result.type؛ poll حالة الفاتورة وفرّع confirmed/pending/failed كما الموقع |
| P1-22 | حجز الموبايل لا يختار duration option أبداً؛ يعرض السعر الأساسي لا المُحاسَب عليه | `[serviceId].tsx:55-61`، `schedule.tsx`، `confirm.tsx` | أضف خطوة اختيار duration/delivery تستدعي نفس endpoint الموقع ومرّر السعر الحقيقي |
| P1-23 | دخول الحجز inline في الموقع بالبريد فقط بينما التسجيل بالجوال أولاً (مسار سعيد مكسور للطريقة الأساسية) | `client-info-step.tsx:84` | اقبل الجوال (normalizeSaudiPhone + {phone,password}) كصفحة /login |

**الداشبورد (pagination):**

| # | العيب | الموقع | الإصلاح |
|---|---|---|---|
| P1-24 | قوائم الخدمات/الموظفين/المستخدمين تُرقّم مرتين أو لا تصل لما بعد أول 20 صفاً (DataTable بلا serverPaginated) | `services-tab-content.tsx:125-148`؛ `employees-list-content.tsx:112-137`؛ `user-list-page.tsx:120` | مرّر serverPaginated + page/totalPages/onPageChange واحذف pager المكرر |

---

## 3. ملخص حسب البُعد

| البُعد | P0 | P1 | P2 | P3 | الأهم |
|---|---|---|---|---|---|
| **Functional** | 0 | 8 | 6 | ~10 | شاشة نجاح موبايل كاذبة (P1-21) + إلغاء off-gateway يُجهض (P1-1) |
| **BusinessLogic** | 1 | 4 | ~7 | ~10 | P0 موافقة-الإلغاء لا تُعيد المال (P0-1) |
| **Architecture** | 0 | 5 | ~7 | ~14 | payment events بلا outbox + attempts=1 (P1-12/13/14) |
| **Code** | 0 | 2 | ~9 | ~12 | تكرار G3 reconciliation (شحن مزدوج محتمل، P1-4) |
| **Security** | 0 | 1 | ~9 | ~12 | client tokenVersion يقفل الدخول بعد reset (P1-7) |
| **Database** | 0 | 3 | ~8 | ~9 | فهرس pgvector غائب في الإنتاج (P1-17) + delete-employee orphans (P1-18) |
| **API** | 0 | 1 | ~9 | ~8 | guard-thrown errors تفقد requestId (P2) + drift gate سطحي (P1-16) |
| **Performance** | 0 | 4 | ~9 | ~8 | شريط التوفر التسلسلي (P1-19) + kataلوج الباقات بلا cache (P1-20) |

**ملاحظة:** بُعدا owasp-injection-xss و authorization-idor عادا **نظيفين** (لا عيوب P0/P1) — مسارات SQL كلها parameterized، XSS sinks مُحصَّنة، IDOR محكوم باشتقاق clientId من الجلسة دائماً. dependency-vulns: **صفر critical/high قابلة للاستغلال** فعلياً.

---

## 4. P2 / P3 — مجمَّعة كمحاور

- **انحراف رياضيات VAT الكامن (غير حي عند VAT=0):** CreateInvoiceHandler يتجاهل OrganizationSettings.vatRate؛ enroll-in-program يدوّر VAT يدوياً بدل computeVat؛ isLastRefund dead code (residual ±1 halala)؛ allocation تناسبي خاطئ لفواتير deposit+balance. **كلها تنفجر فقط لو سجّل المركز ضريبياً.**
- **تكرار الكود (DRY):** create-booking ↔ book-from-credit (validation/snapshot/lock/number)؛ refund-payment finalize ×3؛ إنشاء فاتورة الحجز في 3 معالجات؛ website money helpers محلية بدل @sawaa/shared.
- **انتهاكات thin-controller:** ~10 controllers تحقن PrismaService وتشغّل query/business logic مباشرة (portal summary، mobile employee clients، public catalog، ownership checks)؛ register.handler يستهلك express Request خاماً.
- **at-least-once هشاشة الأحداث:** لا eventId dedup؛ job واحد يتفرّع لمشتركين متعددين (retry يعيد الناجحين)؛ receipt-email بلا already-sent guard؛ نافذة إسقاط أحداث boot.
- **نظافة cache cross-invalidation:** كتالوج عام لا يُبطَل عند تغيير department/category/VAT؛ قوائم أقسام/تصنيفات تُضمّن عدّ خدمات لا يُبطَل عند طفرة خدمة.
- **جودة المخطط:** money typed Decimal(12,2) بينما الوحدة halalas صحيحة؛ timestamps بلا tz عدا OutboxEvent؛ enums عابرة-BC (DeliveryType/DiscountType)؛ أعمدة نص-حر لمجموعات مغلقة.
- **اتساق REST:** refund بأفعال مختلفة (PATCH vs POST)؛ booking lifecycle PATCH في الداشبورد POST في الموبايل؛ auth على /auth بدل /public/auth؛ info.version="2.0" بينما كل المسارات v1.
- **dead code/concept leakage:** OrganizationSwitcherSection shim، problem-reports/integrations endpoints بلا UI، billing/subscription + ORG_SUSPENDED types (تنتهك single-tenant)، aliases موبايل deprecated.
- **tech-debt frontend:** website booking page 1322 سطراً؛ ملفات داشبورد تتجاوز 350 سطراً بلا EXCEPTION؛ hugeicons namespace import (5.2MB)؛ قاموسا AR+EN يُشحنان كاملين على كل route.
- **scalability ceilings:** عملية واحدة تجمع HTTP+workers بلا replicas؛ reports تتزامن في request thread؛ DB pool=10؛ migrate-on-boot.
- **dependency hygiene:** بوابة `--audit-level=high` تخفي advisories (منها Turbo CVSS 9.8 مصنّف low)؛ bump سهل لـ @opentelemetry/core + joi + turbo.

---

## 5. أنماط متقاطعة ومخاطر نظامية

1. **VAT=0 يُخفي فئة كاملة من العيوب:** ≥6 مسارات VAT منحرفة (CreateInvoice fallback، enroll-in-program rounding، isLastRefund dead، per-payment allocation) كلها صحيحة اليوم فقط لأن المعدّل صفر. **خطر نظامي: أي تسجيل ضريبي مستقبلي يُفعّل تباينات هللات صامتة عبر مسارات فاتورة متعددة.** التوصية: توحيد كل حساب VAT خلف computeVat قبل أي تفعيل ضريبي.

2. **at-least-once delivery غير مضمون على مسار المال:** P0-1 + P1-12/13/14 كلها أعراض لنفس الجذر — أحداث المال تُنشَر خارج tx، بـ attempts=1، بلا outbox، بلا dedup، والمُنقذ (reconcile) أعمى عن الصفوف المكتملة. هذه أخطر مجموعة نظامية: **المال قد يُحصَّل دون تأكيد حجز/إيصال/استرداد، بلا شبكة أمان.**

3. **UI-vs-enforcement divergence:** صلاحيات الداشبورد (P1-8) والموبايل parity gaps (P1-21/22) — الواجهة تعرض حالة لا تطابق ما يفرضه/يُحاسب عليه الخادم.

4. **cross-BC referential integrity بلا فرض DB:** كل الروابط العابرة-BC نصوص بلا FK؛ P1-18 + delete-booking orphans أعراض. **لا cron orphan-sweep ولا checklist** — كل delete handler جديد قد يُيتّم بصمت. التوصية: cron كشف يتامى في ops + بند checklist إلزامي.

5. **التكرار في كود المال owner-only:** G3 reconciliation و refund finalize مكرَّرة حرفياً — انحراف نسخة واحدة = شحن/استرداد مزدوج.

6. **بوابات drift سطحية:** api-client (path+method فقط) و audit gate (high فقط) و openapi (مولّدان مكرَّران) — كلها تعطي طمأنينة كاذبة.

---

## 6. تعارضات محتملة مع invariants (للمالك ليرفضها كإيجابيات كاذبة)

- **"money typed Decimal(12,2) لكن الوحدة halalas"** (Database/schema-design): **ليس عيباً حياً** — كل الكتابات تمر عبر halalas helper والصفوف تُخزَّن صحيحة. invariant "money = integer halalas" محفوظ؛ الملاحظة عن نوع العمود لا عن البيانات.
- **"CreateInvoiceHandler VAT fallback = 0 يخالف DTO doc"** (BusinessLogic/vat): **صحيح وظيفياً اليوم** لأن VAT=0 invariant؛ التعارض doc-vs-code فقط، ليس عيب مال حي.
- **كل عيوب VAT المؤجَّلة (isLastRefund، per-payment allocation، enroll rounding):** غير حيّة بحكم VAT=0؛ لا تُعالَج إلا قبل تسجيل ضريبي.
- **"branchId/Branch model باقيان"** و **"SiteSetting جدول مهجور باقٍ"**: مذكوران في dead-code لكنهما **متروكان عمداً** حسب CLAUDE.md — ليسا عيوباً.
- **"billing/subscription + ORG_SUSPENDED types"** (shared-packages): **يخالفان single-tenant invariant فعلاً** لكن كـ dead code يجب حذفه، لا كميزة تُبنى — التوصية حذف وليس تفعيل.
- **"earnings byMethod rounding drift"** (commission): display-only؛ لا حركة مال — متوافق مع invariant "earnings informational only".

---

**الثقة:** عالية على P0-1 (مؤكَّد بفحص الكود مباشرة) وعلى عيوب المال/التزامن (مدعومة بـ file:line محددة). متوسطة على تقديرات أعداد P2/P3 (تقريبية من التجميع). كل عيب أعلاه مُرسى في file:line حقيقي من تقارير الوكلاء.