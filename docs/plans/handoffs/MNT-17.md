# تسليم MNT-17 — ملكية الكتابة بين `bookings` و`finance`

**التاريخ:** 2026-11-19  
**الفرع الأساس:** `integration/maintainability` عند `ebde0b6e2`  
**الحالة:** جاهز للبدء — لم يُنفَّذ أي تغيير إنتاجي بعد.

## الهدف

أن يكتب كل جدول Prisma في مالكه فقط داخل الوحدات، مع بقاء القراءة مسموحة، ودون تغيير أي نتيجة ظاهرة للعميل أو ترتيب عمليات المعاملة.

**معيار القبول المثبت:** صفر كتابات Prisma عابرة بين `bookings` و`finance` في فحص MNT-05، مع نجاح `gate` و`critical-real-e2e` و`pnpm test:premerge`، وتشغيل Moyasar sandbox موثق للمسارات المالية.

## الحالة الحالية

**غير جاهز للتنفيذ المباشر كمهمة واحدة.** السبب: 20 موضع كتابة فعلي في 12 ملفًا بين الوحدتين، بينها مواضع في `create-booking` و`delete-booking` وهما مساران ماليان حساسان. يجب تقسيمه إلى PRs صغيرة متتابعة مع موافقة مالك لكل مسار مالي.

**قياس اليوم (2026-11-19، من `scripts/backend-boundaries-baseline.json` والفحص الفعلي):**

| الاتجاه | مواضع الكتابة | الملفات |
|---|---:|---:|
| `bookings` → `finance` | 11 | 7 |
| `finance` → `bookings` | 9 | 5 |
| **الإجمالي** | **20** | **12** |

> ملاحظة تصحيحية: الخطة الأصلية تقول «10 في الاتجاه المعاكس (5 ملفات)». القياس الفعلي اليوم **9 مواضع في 5 ملفات**؛ الوثيقة تعتمد القياس الفعلي.

### مواضع `bookings` → `finance`

- `apps/backend/src/modules/bookings/enroll-in-program/enroll-in-program.handler.ts` — `tx.invoice.create`
- `apps/backend/src/modules/bookings/record-late-session/record-late-session.handler.ts` — `tx.invoice.create`
- `apps/backend/src/modules/bookings/complete-booking/complete-booking.handler.ts` — `tx.invoice.create`
- `apps/backend/src/modules/bookings/client/client-cancel-booking.handler.ts` — `tx.coupon.updateMany`
- `apps/backend/src/modules/bookings/delete-booking/delete-booking.handler.ts` — `tx.refundRequest.deleteMany` + `tx.paymentCollectionIdempotency.deleteMany` + `tx.payment.deleteMany` + `tx.invoice.delete` (4 مواضع)
- `apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.ts` — `tx.coupon.updateMany`
- `apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts` — `tx.coupon.update` + `tx.invoice.create` (موضعان)

### مواضع `finance` → `bookings`

- `apps/backend/src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler.ts` — `tx.packagePurchase.create` + `tx.packageCredit.create`
- `apps/backend/src/modules/finance/package-purchases/package-group-purchase-snapshot.ts` — `tx.packagePurchaseGroup.create` + `tx.packagePurchaseGroup.update` + `tx.packageCredit.create` (3 مواضع)
- `apps/backend/src/modules/finance/package-purchases/activate-package-purchase/activate-package-purchase.handler.ts` — `tx.packagePurchase.updateMany` + `tx.packageCredit.create`
- `apps/backend/src/modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler.ts` — `tx.packagePurchase.create`
- `apps/backend/src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.ts` — `tx.packagePurchase.updateMany` + `tx.packageCreditUsage.updateMany`

## ما أُنجز مع دليل

- **قاعدة الحدود موجودة وتعمل** — `node scripts/check-backend-boundaries.mjs` (exit 0) يطبع: 36 حافة استيراد، 8 أزواج ثنائية الاتجاه، 3 استيرادات طبقات معكوسة، 135 موضع كتابة عابر منها 39 على جداول `ops` المسموحة، و96 موضعًا متتبعًا في baseline.
- **الـbaseline مقفل** — `scripts/backend-boundaries-baseline.json` يحتوي 250 مدخلًا، ويمنع أي اقتران جديد ويفشل عند بقاء مدخل محسوم (stale).
- **عداد المواضع المحدد** — استعلامات `node -e` على الـbaseline أعطت 11/9 و19/3 و27/3 للأزواج المطلوبة.
- **السجل التاريخي** — `docs/plans/maintainability-roadmap.md` يوثّق القياسات السابقة وMNT-05، وسطر المراجعة في 19 نوفمبر 2026 يثبت أن الكتابات العابرة بقيت 96.
- **ملف الترحيل والتشغيل** — `docs/operations/migration-charter.md` و`docs/operations/deployment-policy.md` يحددان قيود أي تغيير على قاعدة البيانات والنشر.

**غير مُتحقق:** لم يُشغَّل `pnpm test:premerge` ولا `pnpm --filter=backend run test:e2e:critical` في هذه الجلسة، ولا يوجد تشغيل Moyasar sandbox. أي ادعاء عن سلامة سلوكية بعد التغيير يحتاج هذه الأدلة قبل الدمج.

## ما تبقى

| # | المهمة | المالك | معيار الإنجاز |
|---|---|---|---|
| 17.1 | خدمة `finance` ضيقة تستقبل `tx`: `createInvoiceInTx` و`recordPaymentInTx` و`releaseCouponInTx` | DeepSeek بتوجيه ومراجعة | دوال مُصدَّرة من `FinanceModule`، اختبارات وحدة، ولا تغيير في `openapi.json` |
| 17.2 | خدمة `bookings` ضيقة تستقبل `tx` لتغيير حالة الحجز والرصيد | DeepSeek بتوجيه ومراجعة | مُصدَّرة من `BookingsModule`، اختبارات وحدة |
| 17.3 | ترحيل `bookings` → `finance` موضعًا واحدًا لكل PR، بالترتيب: `complete-booking`، `record-late-session`، `enroll-in-program`، `cancel-booking`، `client-cancel-booking`، ثم `create-booking`، ثم `delete-booking` | DeepSeek + موافقة مالك للمالية | كل PR يخفض الـbaseline بمواضعه فقط، و`gate` أخضر |
| 17.4 | ترحيل `finance` → `bookings` على دفعات الباقات فقط | DeepSeek + موافقة مالك للمالية | صفر مواضع `package*` في baseline لـ`finance` |
| 17.5 | تشغيل Moyasar sandbox على المسارات المالية المتأثرة | المالك | سجل نتيجة موثق في PR |
| 17.6 | تحديث الـbaseline والخطة وسطر المراجعة | DeepSeek | `git diff` يثبت الحذف فقط، بلا إضافات |

**الترتيب الإلزامي:** لا يبدأ 17.4 قبل اكتمال 17.3، ولا يُدمج أي PR مالي قبل 17.5.

## المخاطر

- **تغيير ترتيب عمليات المعاملة** — الأثر: سباق أو فاتورة مزدوجة أو رصيد سالب. التخفيف: الخدمة تستقبل `tx` نفسه، ولا يُنقل أي استعلام خارج المعاملة، واختبارات تزامن قائمة في `test:e2e:critical`.
- **`delete-booking` يحذف 4 جداول مالية** — الأثر: حذف بيانات مالية أو كسر مسار الاسترجاع. التخفيف: PR مستقل، وموافقة مالك، وتشغيل اختبارات `invoice-delete-race` و`refund-invoice-concurrency`.
- **`create-booking` محمي صراحة في `AGENTS.md`** — الأثر: مخالفة سياسة المشروع. التخفيف: لا يُلمس قبل موافقة مالك صريحة واختبارات وMoyasar sandbox.
- **قراءة `finance` من `bookings`** — الأثر: قد يظل الاقتران قائمًا لأن الهدف يخص الكتابة فقط. التخفيف: لا توسيع النطاق؛ القراءة تبقى مسموحة ومقيسة منفصلة.
- **حجم الـbaseline** — الأثر: تحديث خاطئ يخفي مواضع جديدة. التخفيف: `--write-baseline` ممنوع؛ تُحذف السطور يدويًا ويُثبت `git diff` أن التغيير حذف فقط.

## كيفية التشغيل والتحقق

```bash
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0=false

git worktree add .worktrees/mnt17 -b codex/mnt-17-bookings-finance origin/integration/maintainability
cd .worktrees/mnt17
pnpm install --frozen-lockfile --ignore-scripts
```

```bash
node scripts/check-backend-boundaries.mjs
pnpm --filter=backend test -- apps/backend/src/modules/bookings/create-booking/create-booking.handler.spec.ts
pnpm --filter=backend test -- apps/backend/src/modules/finance/refund-payment/refund-payment.handler.spec.ts
pnpm --filter=backend run test:e2e:critical
pnpm openapi:sync
git diff --exit-code -- apps/backend/openapi.json
```

```bash
pnpm test:premerge
```

قبل الدمج يجب أن يكون مخرَج فحص الحدود بلا مواضع `bookings -> finance`، وأن يظل `git diff --exit-code -- apps/backend/openapi.json` ناجحًا (صفر تغيير عقد).

## القرارات

- **خدمات داخل المعاملة بدل أحداث غير متزامنة** — البديل المرفوض: outbox أو حدث بعد commit. السبب: يغيّر ضمانات الاتساق ويفتح نافذة فشل جزئي على مسارات مدفوعات حية.
- **PR لكل handler مالي** — البديل المرفوض: PR واحد للعشرين موضعًا. السبب: يصعّب العزل والمراجعة والرجوع، ويكسر قاعدة «موضع واحد في كل PR للمسارات الأخطر».
- **عدم حذف الـbaseline بالكامل** — البديل المرفوض: تفريغ الملف بعد الإصلاح. السبب: يفقد الحارس قدرته على منع عودة الاقتران.
- **الاعتماد على القياس الفعلي لا رقم الخطة** — البديل المرفوض: استخدام «10 مواضع». السبب: القياس أعطى 9، والقاعدة أن الدليل قبل الادعاء.

## جهات الاتصال ومسارات الملفات

- **مالك القرار:** طارق الوليدي — موافقة إلزامية للمسارات المالية.
- **المنفذ:** DeepSeek — بتوجيه ومراجعة من الوكيل الرئيسي.
- **المرجع:** `docs/plans/maintainability-roadmap.md`
- **الحارس:** `scripts/check-backend-boundaries.mjs`
- **الـbaseline:** `scripts/backend-boundaries-baseline.json`
- **الكود المتأثر:** `apps/backend/src/modules/bookings/` و`apps/backend/src/modules/finance/`
- **سياسة النشر:** `docs/operations/deployment-policy.md`
