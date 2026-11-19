# MNT-17 — المرحلة 0: التحقق وتصميم الخدمة الضيقة

**التاريخ:** 2026-11-19

**الفرع:** `codex/mnt-17-step1-design` من `integration/maintainability` عند `ebdddce4e5f261f4f598a10ab710661a6bb46073`

**النطاق:** تصميم وقياس فقط. **لا تغيير في كود الإنتاج، ولا في أي call-site، ولا في `openapi.json`، ولا في الـbaseline.**

> هذه الوثيقة تنفّذ البند 17.1 من [MNT-17](./MNT-17.md) (المرحلة 0). البنود 17.2–17.6 تبقى مفتوحة وتُنفَّذ في PRs لاحقة وفق الخطة في القسم 6.

---

## 1. الهدف والنطاق

الهدف النهائي لـMNT-17: **كل جدول Prisma يُكتب من مالكه فقط**، مع بقاء القراءة مسموحة، ودون أي تغيير في نتيجة ظاهرة للعميل أو في ترتيب عمليات المعاملة.

هذه المرحلة تسلّم ثلاثة أشياء فقط:

1. قياس مستقل وقابل لإعادة الإنتاج لأعداد المواضع العابرة، ومقارنته بالهاند أوف.
2. تصميم مكتوب لواجهتين ضيقتين تستقبلان `tx` (اتجاه `bookings → finance` واتجاه `finance → bookings`).
3. مصفوفة اختبارات وخطة ترحيل مرتبة ومخاطر رجوع.

**خارج النطاق صراحةً:** أي تعديل على `apps/backend/src/**`، `apps/backend/openapi.json`، `scripts/backend-boundaries-baseline.json`، `.github/**`، `AGENTS.md`، `CLAUDE.md`، أو منطق المدفوعات/Moyasar.

---

## 2. التحقق من الأرقام (دليل قابل للتكرار)

### 2.1 فحص الحدود

```bash
node scripts/check-backend-boundaries.mjs
# exit 0
```

المخرَج الفعلي:

```text
Backend boundary summary
  module import edges: 36 (202 import statements in 126 files)
  bidirectional module pairs: 8
  reverse-layer import entries: 3
  cross-cluster Prisma write call sites: 135
    on ops-owned tables: 39 (shared allowed activityLog/outboxEvent: 39, never violations)
    excluding ops-owned tables: 96 (these are the tracked write entries)
  baseline-tracked entries: 250
✓ Backend module boundaries match the baseline.
```

هذا يطابق حرفيًا ما ورد في [MNT-17](./MNT-17.md) قسم «ما أُنجز مع دليل». **لا فرق.**

### 2.2 استخراج مواضع `bookings ↔ finance` من الـbaseline

```bash
node -e '
const a=require("./scripts/backend-boundaries-baseline.json");
const w=a.filter(x=>/^write (bookings -> finance|finance -> bookings)/.test(x));
for (const d of ["bookings -> finance","finance -> bookings"]) {
  const e=w.filter(x=>x.startsWith("write "+d));
  const files=new Set(e.map(x=>x.match(/\((.*)\)$/)[1]));
  console.log(d,"entries:",e.length,"files:",files.size);
  e.forEach(x=>console.log("  ",x));
}'
# exit 0
```

النتيجة: **11 مدخلًا في 7 ملفات** لـ`bookings → finance`، و**9 مداخل في 5 ملفات** لـ`finance → bookings`. الإجمالي **20 مدخلًا في 12 ملفًا**.

| الاتجاه | مداخل baseline | ملفات | مطابقة الهاند أوف |
|---|---:|---:|---|
| `bookings → finance` | 11 | 7 | ✅ مطابق |
| `finance → bookings` | 9 | 5 | ✅ مطابق (والخطة القديمة «10» خاطئة كما ذكر الهاند أوف) |

### 2.3 الملفات والجداول المستهدفة

`bookings → finance` — 7 ملفات / 11 مدخلًا:

| الملف | الجداول المكتوبة |
|---|---|
| `bookings/cancel-booking/cancel-booking.handler.ts` | `finance.coupon` |
| `bookings/client/client-cancel-booking.handler.ts` | `finance.coupon` |
| `bookings/complete-booking/complete-booking.handler.ts` | `finance.invoice` |
| `bookings/create-booking/create-booking.handler.ts` | `finance.coupon`، `finance.invoice` |
| `bookings/delete-booking/delete-booking.handler.ts` | `finance.invoice`، `finance.payment`، `finance.paymentCollectionIdempotency`، `finance.refundRequest` |
| `bookings/enroll-in-program/enroll-in-program.handler.ts` | `finance.invoice` |
| `bookings/record-late-session/record-late-session.handler.ts` | `finance.invoice` |

`finance → bookings` — 5 ملفات / 9 مداخلًا:

| الملف | الجداول المكتوبة |
|---|---|
| `finance/package-purchases/create-package-purchase/create-package-purchase.handler.ts` | `packagePurchase`، `packageCredit` |
| `finance/package-purchases/init-package-purchase/init-package-purchase.handler.ts` | `packagePurchase` |
| `finance/package-purchases/activate-package-purchase/activate-package-purchase.handler.ts` | `packagePurchase`، `packageCredit` |
| `finance/package-purchases/package-group-purchase-snapshot.ts` | `packagePurchaseGroup`، `packageCredit` |
| `finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.ts` | `packagePurchase`، `packageCreditUsage` |

### 2.4 ثلاث دقائق قياس يجب ألا تُفقد

**(أ) الـbaseline يسجّل «ملف + جدول»، لا «استدعاء».**

`package-group-purchase-snapshot.ts` ينفّذ ثلاث عمليات فعليّة (`packagePurchaseGroup.create`، `packagePurchaseGroup.update`، `packageCredit.create`) لكنها تُختزل إلى مدخلَين لأنهما نفس زوج (ملف، جدول). لذلك:

- **9 مداخل baseline = 10 استدعاءات فعلية** في اتجاه `finance → bookings`.
- في اتجاه `bookings → finance` يتساوى العددان (11 = 11) لأن كل ملف يكتب كل جدول مرّة واحدة.

معيار القبول يجب أن يُصاغ على **الاستدعاءات** لا على المداخل، وإلا بقي استدعاء واحد مخفيًا داخل مدخل موجود.

**(ب) هناك كتابة عابرة لا يراها الفحص إطلاقًا.**

`finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.ts:266` ينفّذ:

```sql
UPDATE "PackageCredit" SET "usedQuantity" = "totalQuantity", "reservedQuantity" = 0 WHERE "purchaseId" = ...
```

عبر `$executeRaw`. أداة الفحص تعتمد تعبيرًا نمطيًا على `tx.<model>.<op>` (انظر رأس `scripts/check-backend-boundaries.mjs`)، فـ`$executeRaw` خارج تغطيتها المعلنة. **لو حُذفت الـ9 مداخل وحدها، سيطبع الفحص «صفر» بينما تبقى كتابة عابرة حقيقية على `PackageCredit`.** الخدمة الضيقة يجب أن تملك هذه العبارة أيضًا، ويجب إثبات ذلك بمراجعة يدوية (`rg`) لا بالفحص وحده.

**(ج) `delete-booking` يحتاج 4 مداخل لكن 4 عمليات حذف فقط.** الأقفال الثلاثة (`PaymentCollectionIdempotency`، `RefundRequest`، `Payment`) موجودة كاستعلامات `FOR UPDATE NOWAIT` ولا تُحتسب كتابةً. أي ترحيل ينقل الحذف دون نقل الأقفال سيغيّر ترتيب الأقفال فعليًا — وهذا مرفوض في التصميم أدناه.

### 2.5 الأوامر التي شُغّلت في هذه المرحلة

| الأمر | النتيجة |
|---|---|
| `git fetch origin integration/maintainability` | exit 0، `origin/integration/maintainability` = `ebdddce4e5f261f4f598a10ab710661a6bb46073` |
| `node scripts/check-backend-boundaries.mjs` | exit 0، مطابق للـbaseline |
| `git worktree add .worktrees/mnt17-step1 -b codex/mnt-17-step1-design origin/integration/maintainability` | exit 0 |
| `git diff --check` | exit 0 |

لم تُشغَّل أي اختبارات (Jest / e2e / premerge) في هذه المرحلة لأنها لا تُغيّر كودًا. أي ادعاء بسلامة سلوكية بعد الترحيل يبقى مؤجلًا إلى أدلة PRs اللاحقة.

---

## 3. ثوابت التصميم

1. **الخدمة تستقبل `tx: Prisma.TransactionClient` ولا تفتح معاملة.** لا `TransactionService` داخل أي دالة، ولا `this.prisma` كبديل. هذا هو الضمان الوحيد ضد تغيير حدود الاتساق.
2. **لا نقل لأي استعلام خارج معاملة المستدعي.** الترتيب داخل `tx` يبقى كما هو حرفيًا: الاستدعاء يحل مكان العبارة في نفس الموضع.
3. **الخدمة لا تنشر أحداثًا.** `publishOptional` يبقى في الـhandler بعد الـcommit، كما هو اليوم.
4. **الخدمة لا تضيف قواعد عمل جديدة.** مثال: `create-booking` يزيد `usedCount` بلا شرط `maxUses` لأن قفل الكوبون الاستشاري + `ValidateCouponService` يضمنان الحد. الخدمة تحافظ على ذلك ولا «تُحصّن» السلوك لأن التحصين تغيير سلوكي.
5. **تغيير الأخطاء ممنوع.** نفس نوع الاستثناء ونفس الرسالة ونفس رمز HTTP. رسائل `delete-booking` العربية تصل للمستخدم عبر `HttpExceptionFilter`، فلا تُعاد صياغتها.
6. **كل PR يحذف أسطره من الـbaseline يدويًا فقط.** لا `--write-baseline`. الـdiff يجب أن يُظهر حذفًا فقط في هذا الملف.
7. **صفر تغيير في العقد:** `git diff --exit-code -- apps/backend/openapi.json` بعد `pnpm openapi:sync`.

---

## 4. الواجهة الأولى: `BookingFinanceLedgerService` (finance → يستخدمه bookings)

### 4.1 الموقع والتسجيل

```text
apps/backend/src/modules/finance/booking-finance/
├── booking-finance-ledger.service.ts      # @Injectable
├── booking-finance-ledger.types.ts        # الأوامر والنتائج والأخطاء
└── booking-finance-ledger.service.spec.ts
```

- مُسجَّل في `providers` داخل `FinanceModule` ومُصدَّر في `exports`.
- `BookingsModule` **يستورده بالفعل** (`bookings.module.ts:12` و`:155`)، لذا لا يتغيّر الرسم البياني للوحدات ولا يُضاف `forwardRef`.
- لا يعتمد على `BookingsModule` ولا على أي وحدة أعلى — يعتمد على `DatabaseModule` فقط (وفعليًا لا يحتاجها لأن `tx` يُمرَّر).

### 4.2 الأنواع

```ts
import type { Prisma } from '@prisma/client';

export type BookingInvoiceIssueMode = 'DRAFT' | 'ISSUED';

export interface CreateBookingInvoiceInTxCommand {
  bookingId: string;
  branchId: string;
  clientId: string;
  employeeId: string | null;
  currency: string;
  /** صافي قبل الضريبة، بوحدات الهلالة */
  subtotal: number | Prisma.Decimal;
  /** خصم الكوبون، إن وُجد */
  discountAmt?: number | Prisma.Decimal;
  issueMode: BookingInvoiceIssueMode;
  /** مطلوب فقط عندما issueMode = 'ISSUED' */
  issuedAt?: Date;
  /** عند تمريره يتجاوز قراءة OrganizationSettings؛ وإلا resolveVatRate(tx) */
  vatRate?: number | Prisma.Decimal;
}

export interface BookingInvoiceInTxResult {
  id: string;
  subtotal: Prisma.Decimal;
  discountAmt: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  vatAmt: Prisma.Decimal;
  total: Prisma.Decimal;
  status: 'DRAFT' | 'ISSUED';
  issuedAt: Date | null;
}

export class BookingHasBlockingPaymentError extends Error {}
export class BookingInvoiceAlreadyExistsError extends Error {}
```

### 4.3 الدوال

| # | التوقيع | المدخلات | المخرجات | الأخطاء | المواضع التي تحلّ محلها |
|---|---|---|---|---|---|
| 1 | `createBookingInvoiceInTx(tx, cmd)` | `CreateBookingInvoiceInTxCommand` | `BookingInvoiceInTxResult` | `BookingInvoiceAlreadyExistsError` عند انتهاك `@@unique([bookingId])` (P2002) — يُرمى كما هو اليوم بلا pre-check | `create-booking` (invoice.create, DRAFT) · `enroll-in-program` (invoice.create, DRAFT) · `record-late-session` (invoice.create, DRAFT) |
| 2 | `ensureBookingInvoiceInTx(tx, cmd)` | نفس المدخلات | `BookingInvoiceInTxResult \| null` (`null` = فاتورة موجودة، بلا تعديل) | كما في `createBookingInvoiceInTx` للمسار الإنشائي | `complete-booking` (`findUnique` ثم `create` بحالة `ISSUED` + `issuedAt`) |
| 3 | `consumeCouponUsageInTx(tx, { couponId })` | `couponId` | `void` | `NotFoundError` (P2025) كما اليوم | `create-booking` (`coupon.update` increment) |
| 4 | `releaseCouponUsageInTx(tx, { code })` | `code` | `{ released: boolean }` (من `count > 0`) | لا يرمي | `cancel-booking` · `client-cancel-booking` (`coupon.updateMany` decrement محروس بـ`usedCount > 0`) |
| 5 | `deleteBookingInvoiceAndFinancialsInTx(tx, { bookingId })` | `bookingId` | `{ invoiceId: string \| null }` | `BookingHasBlockingPaymentError` (يحلّ محل 400 العربية في الـhandler) · أخطاء `55P03` تُترك تصعد كما اليوم | `delete-booking` (4 عمليات حذف + 4 أقفال) |

**ملاحظة على الدالة 5:** تنقل — بنفس الترتيب — `SELECT ... "Invoice" ... FOR UPDATE NOWAIT` ثم أقفال `PaymentCollectionIdempotency` ثم `RefundRequest` ثم `Payment`، ثم فحص الدفع المانع، ثم `refundRequest.deleteMany` → `paymentCollectionIdempotency.deleteMany` → `payment.deleteMany` → `invoice.delete`. قائمة حالات الدفع المانعة (`COMPLETED`, `PARTIALLY_REFUNDED`, `REFUNDED`, `PENDING_VERIFICATION`) تنتقل إلى وحدة finance لأنها سياسة مالية. الـhandler يحوّل `BookingHasBlockingPaymentError` إلى نفس `BadRequestException` بنفس النص العربي، ويُبقي `isLockNotAvailable` → `ConflictException(financeBusy)` كما هو.

**`recordPaymentInTx` غير مطلوب.** الهاند أوف يذكره، لكن `ProcessPaymentHandler.execute({ ..., transaction: tx })` يدعم مشاركة معاملة قائمة بالفعل (الحقل `transaction?: Prisma.TransactionClient` في `process-payment.handler.ts:20`) وهو مُصدَّر من `FinanceModule`. إضافة دالة مكرّرة ستكون سطحًا زائدًا بلا مقابل، وقد تُغري بمسار دفع ثانٍ — وهذا مرفوض في مسار مالي. القرار: **لا نضيفها**، ونستخدم الـhandler القائم.

### 4.4 كيف تُبنى الدوال دون تغيير سلوك

- `resolveVatRate(tx)` و`computeVat(...)` الموجودتان في `finance/create-invoice/create-invoice.handler.ts` و`finance/money.helper.ts` تُستخدمان كما هما. `enroll-in-program` يحسب الضريبة يدويًا بنفس صيغة `computeVat` (`mul` ثم `toDecimalPlaces(0)` ثم `add`)، والنتيجة العددية متطابقة.
- `create-booking` يمرّر `subtotal = price` و`discountAmt = price - discountedPrice`؛ الخدمة تحسب `vatBase = subtotal - discountAmt` داخليًا كما يفعل الكود الحالي.
- `complete-booking` تمرّر `issueMode: 'ISSUED'` مع `issuedAt = new Date()`، و`ensureBookingInvoiceInTx` تُرجع `null` إذا وُجدت فاتورة (بدل الإنشاء) — سلوك «لا-op صامت» الحالي.
- `CreateInvoiceHandler.execute` (المسار العام) يبقى كما هو. يُعاد استخدام الدالة الجديدة داخله فقط في PR مستقل إن لزم، وليس في 17.1.

---

## 5. الواجهة الثانية: `PackageLedgerService` (bookings → يستخدمه finance)

### 5.1 المشكلة البنيوية

`BookingsModule` يستورد `FinanceModule`. لو أضفنا `FinanceModule` يستورد `BookingsModule` لإنشاء **دورة وحدات** تحتاج `forwardRef` — وهذا يعاكس هدف MNT-19 صراحةً.

**الحل:** وحدة صغيرة **داخل مجلد bookings** لكنها مستقلّة في الرسم البياني:

```text
apps/backend/src/modules/bookings/package-ledger/
├── package-ledger.module.ts          # imports: [DatabaseModule] فقط
├── package-ledger.service.ts         # @Injectable
├── package-ledger.types.ts
└── package-ledger.service.spec.ts
```

- `BookingsModule` يستورد `PackageLedgerModule`.
- `FinanceModule` يستورد `PackageLedgerModule` أيضًا.
- `PackageLedgerModule` **لا** يستورد `BookingsModule` ولا `FinanceModule` → لا دورة، ولا `forwardRef`.
- ملفاتها تحت `modules/bookings/**`، لذا يراها الفحص مملوكة لـ`bookings`، والكتابات على جداول `bookings.prisma` ليست مخالفة. **لا حاجة لتعديل `MULTI_OWNER` ولا الـbaseline لهذا السبب.**

### 5.2 قرار الملكية (يحتاج تثبيت المالك)

جداول `PackagePurchase` / `PackageCredit*` معرّفة في `prisma/schema/bookings.prisma`، ويستهلكها `book-from-credit` و`transfer-credit` و`package-credit-consume/return` داخل bookings. التصميم يثبّت **bookings مالكًا**، وfinance عميلًا يمرّ عبر الخدمة. البديل (نقل النماذج إلى `finance.prisma`) **لا يُصلح الدين بل ينقله**: سيحوّل 12 استدعاءً في `book-from-credit` و`transfer-credit` و`package-credit-consume` و`package-credit-return` إلى مخالفات جديدة. لذلك يُرفض في هذا النطاق، ويبقى خيارًا يحتاج ADR وموافقة مالك منفصلة.

### 5.3 الدوال (كل دالة = عبارة واحدة، حفاظًا على الترتيب)

| # | التوقيع | المدخلات | المخرجات | الأخطاء | يستبدل |
|---|---|---|---|---|---|
| 1 | `createPackagePurchaseInTx(tx, data)` | بيانات الصف كما هي في `create-package-purchase.handler.ts:205` و`init-package-purchase.handler.ts:526` | `{ id: string }` | P2002 كما هو (لا التقاط، لا إعادة محاولة) | `tx.packagePurchase.create` (×2) |
| 2 | `issuePackageCreditsInTx(tx, { purchaseId, snapshot })` | `purchaseId` + `PackagePurchaseSnapshot` (legacy أو GROUPED_V2) | `{ issued: number }` | `BadRequestException('GROUPED_V2 purchase dependency cannot be remapped')` كما هي | `package-group-purchase-snapshot.ts:347,365,373` + حلقة `create-package-purchase.handler.ts:237` + حلقة `activate-package-purchase.handler.ts:173` |
| 3 | `activatePendingPackagePurchaseInTx(tx, { purchaseId, paidAt })` | `purchaseId`, `paidAt` | `{ activated: boolean }` (`false` عند `count === 0`) | لا يرمي | `activate-package-purchase.handler.ts:156` (`updateMany` PENDING → ACTIVE) |
| 4 | `lockPackagePurchaseForRefundInTx(tx, { purchaseId })` | `purchaseId` | صف `{ id, status, amountPaid, refundAmount, clientId, notes }` أو `null` | لا يرمي | `refund-package-purchase.handler.ts:100` (`SELECT ... FOR UPDATE`) — **قفل فقط، بلا كتابة؛ يُنقل ليصحب مالكه** |
| 5 | `markPackagePurchaseRefundInTx(tx, { purchaseId, status, refundedAt, refundAmount, notes })` | الحقول المحسوبة في الـhandler | `{ updated: boolean }` (`false` عند `count === 0`) | لا يرمي | `refund-package-purchase.handler.ts:245` (`updateMany` بحاجز `status != REFUNDED`) |
| 6 | `voidPackageCreditsInTx(tx, { purchaseId })` | `purchaseId` | `{ voided: true }` | لا يرمي | `refund-package-purchase.handler.ts:266` — **العبارة الخام `UPDATE "PackageCredit"`** |
| 7 | `terminateReservedUsagesInTx(tx, { purchaseId, at })` | `purchaseId`, `at` | `{ terminated: number }` | لا يرمي | `refund-package-purchase.handler.ts:284` |

**لماذا سبع دوال دقيقة بدل دالة `refundPackagePurchaseInTx` واحدة؟**

`refund-package-purchase` يخلط بين جداول مالية وباقات بترتيب حساس: قفل purchase → قراءة usages/bookings → قراءة invoice/payments → قفل/تحديث purchase → إفراغ credits → إنهاء usages → قفل invoice وتسجيل الاسترجاع. أي تجميع خشن سينقل عبارات مالية داخل دالة bookings أو بالعكس، ويغيّر الترتيب. الدوال الدقيقة تُبقي **كل استدعاء في موضعه الحرفي**.

**قاعدة أمان إضافية:** الخدمة لا تحصل على أي قفل لم يكن الـhandler يحصل عليه في نفس النقطة. `lockPackagePurchaseForRefundInTx` نقل مكاني لقفل قائم، لا قفل جديد.

---

## 6. خطة الترحيل بالترتيب

كل صف = PR مستقل إلى `integration/maintainability`، merge commit فقط. لا PR يجمع مسارين ماليين.

| المرحلة | PR | المحتوى | الـbaseline المتوقع | موافقة المالك |
|---|---|---|---|---|
| 0 | **هذا PR** | التصميم + القياس | بلا تغيير (250) | لا (توثيق) |
| 1 | `17.1a` | `BookingFinanceLedgerService` + وحدة اختبارات. **بلا استبدال أي call-site** | بلا تغيير (250) | لا (كود جديد غير مستخدم) |
| 2 | `17.1b` | `PackageLedgerService` + `PackageLedgerModule` + اختبارات. بلا استبدال | بلا تغيير (250) | **نعم** — قرار ملكية جداول الباقات (5.2) |
| 3 | `17.3a` | `complete-booking` → `ensureBookingInvoiceInTx` | 250 → 249 | لا (غير مالي حرج) |
| 4 | `17.3b` | `record-late-session` → `createBookingInvoiceInTx` | 249 → 248 | **نعم** (مسار تسجيل جلسة/تحصيل) |
| 5 | `17.3c` | `enroll-in-program` → `createBookingInvoiceInTx` | 248 → 247 | **نعم** (فاتورة برنامج) |
| 6 | `17.3d` | `cancel-booking` → `releaseCouponUsageInTx` | 247 → 246 | لا (كوبون فقط) |
| 7 | `17.3e` | `client-cancel-booking` → `releaseCouponUsageInTx` | 246 → 245 | لا (كوبون فقط) |
| 8 | `17.3f` | `create-booking` → `consumeCouponUsageInTx` + `createBookingInvoiceInTx` (مدخلان) | 245 → 243 | **نعم صريح** — `AGENTS.md` يحمي `create-booking` |
| 9 | `17.3g` | `delete-booking` → `deleteBookingInvoiceAndFinancialsInTx` (4 مداخل) | 243 → 239 | **نعم صريح** — حذف مالي + `invoice-delete-race` |
| 10 | `17.4a` | `create-package-purchase` + `init-package-purchase` → `createPackagePurchaseInTx` | 239 → 237 | **نعم** (بيع باقة) |
| 11 | `17.4b` | `activate-package-purchase` + `issuePackageCreditsInTx` | 237 → 235 | **نعم** (إصدار أرصدة بعد دفع) |
| 12 | `17.4c` | `refund-package-purchase` → الدوال 4–7 | 235 → 233 | **نعم** (استرجاع باقة + العبارة الخام) |
| 13 | `17.5` | Moyasar sandbox على المسارات المالية المتأثرة | بلا تغيير | **المالك ينفّذ ويسجّل** |
| 14 | `17.6` | تنظيف/توثيق + سطر المراجعة | إثبات أن التغيير حذف فقط | لا |

**ترتيب إلزامي:** لا يبدأ 17.4 قبل اكتمال 17.3، ولا يُدمج أي PR مالي قبل 17.5.

**قاعدة كل PR ترحيل (17.3x / 17.4x):**
1. استبدال واحد فقط، دون نقل أي عبارة أخرى.
2. تحديث spec الـhandler بنفس PR (حقن mock للخدمة + التأكد من `toHaveBeenCalledWith(tx, ...)`).
3. حذف أسطر الـbaseline الخاصة بهذا الملف يدويًا، والعدد في وصف الـPR.
4. `rg` يدوي يثبت أن العبارة القديمة اختفت فعليًا.
5. `git diff --exit-code -- apps/backend/openapi.json`.

**تعارض MNT-18:** `create-booking` و`refund-payment` و`moyasar-*` مشتركة. ترتيب MNT-17 أعلاه يضع `create-booking` في المرحلة 8، أي بعد `confirm-operation` و`book-from-credit` في MNT-18 (18.1، 18.2) — لا تزاحم على الملفات. `refund-payment` و`moyasar-webhook` لا يُلمسان في MNT-17 إطلاقًا.

---

## 7. مصفوفة الاختبارات

### 7.1 وحدة (Jest، بلا قاعدة بيانات) — في PR الخدمة نفسه

| الاختبار | ماذا يثبت |
|---|---|
| `booking-finance-ledger.service.spec.ts` | كل دالة تستدعي Prisma بالأمر والوسائط المتوقعة **وبنفس الترتيب** |
| «لا تفتح معاملة» | لا يوجد أي اعتماد على `TransactionService`؛ `new Service()` بلا DI يعمل |
| «لا تنشر أحداثًا» | لا استدعاء لـ`EventBusService` |
| `ensureBookingInvoiceInTx` | يعيد `null` ويصدر **صفر** استدعاء `create` عند وجود فاتورة |
| `createBookingInvoiceInTx` | يترك P2002 يصعد؛ لا pre-check خفي |
| `consumeCouponUsageInTx` | `update({ where: { id }, data: { usedCount: { increment: 1 } } })` بلا شرط `maxUses` (توثيق القرار) |
| `releaseCouponUsageInTx` | `updateMany` بحاجز `usedCount > 0`؛ يعيد `released=false` عند `count=0` |
| `deleteBookingInvoiceAndFinancialsInTx` | ترتيب الأقفال الأربعة ثم الفحص ثم الحذف الأربعة |
| `package-ledger.service.spec.ts` | العبارة الخام `UPDATE "PackageCredit"` تنتقل حرفيًا بنفس شرط `purchaseId` |
| `PackageLedgerModule` | `Test.createTestingModule` ينجح بلا `forwardRef` ولا استيراد متبادل |

### 7.2 تكامل/عقد (Jest على الـhandler بعد الاستبدال)

لكل handler مُرحّل: نفس ملف `*.handler.spec.ts` القائم يجب أن يبقى أخضر **دون تعديل أي توقّع سلوكي**؛ التعديل المسموح هو تزويد mock للخدمة فقط. يثبت هذا أن الشكل الخارجي والرسائل لم تتغير.

### 7.3 تزامن (قاعدة بيانات حقيقية) — يجب أن يبقى أخضر في كل PR

| الملف | يغطي |
|---|---|
| `test/e2e/finance/invoice-delete-race.real-e2e-spec.ts` | حذف الحجز ضد استرجاع/التقاط متزامن (المسار الأخطر) |
| `test/e2e/finance/refund-invoice-concurrency.real-e2e-spec.ts` | سباق الاسترجاع على الفاتورة |
| `test/e2e/finance/native-payment-concurrency.real-e2e-spec.ts` | تزامن الدفع الأصلي |
| `test/e2e/finance/payment-reservation-concurrency.real-e2e-spec.ts` | حجز الدفع |
| `test/e2e/packages/package-credit-concurrency.real-e2e-spec.ts` | إرجاع/استهلاك الرصيد |
| `test/e2e/packages/package-group-concurrency.real-e2e-spec.ts` | تزامن مجموعات الباقات |
| `test/e2e/bookings/client-cancellation-policy.real-e2e-spec.ts` | إلغاء العميل + الكوبون |

**اختبارات جديدة مطلوبة (تُضاف في 17.1a/17.1b، قبل أي ترحيل):**

1. `booking-invoice-parity.real-e2e-spec.ts` — ينشئ حجزًا عبر `create-booking`، وآخر عبر `complete-booking` (payAtClinic)، وانضمام برنامج، وجلسة متأخرة؛ يقارن `subtotal / discountAmt / vatRate / vatAmt / total / status / issuedAt` بين المسار القديم (قبل الاستبدال) والمسار الجديد على نفس المدخلات. يُشغّل قبل وبعد كل PR ترحيل فاتورة.
2. `booking-delete-finance-lock-order.real-e2e-spec.ts` — يفتح معاملة منافسة تحمل قفل `Payment` ويؤكد أن حذف الحجز يفشل بـ`409 financeBusy` (رمز `55P03`) لا بـ500.
3. `package-refund-credit-void.real-e2e-spec.ts` — استرجاع كامل يثبت `PackageCredit.usedQuantity = totalQuantity` و`reservedQuantity = 0` عبر الخدمة الجديدة، وأن `PackageCreditUsage` RESERVED صارت RETURNED.

### 7.4 Moyasar sandbox (المالك)

| المسار | ما يُتحقق منه |
|---|---|
| حجز أونلاين + دفع ناجح | فاتورة DRAFT → PAID، `issuedAt` stamps، لا فاتورة مزدوجة |
| حجز `payAtClinic` ثم إكمال | فاتورة ISSUED عند الإكمال، بلا تكرار |
| استرجاع كامل/جزئي | مبلغ الاسترجاع والضريبة الاسترجاعية مطابقان |
| استرجاع باقة | إفراغ الأرصدة + حالة `REFUNDED` |
| webhook مكرر | لا دفعة/فاتورة ثانية |

سجل النتيجة يُرفق في PR 17.5 ويُذكر SHA المرشح. بدون هذا السجل لا يُدمج أي PR مالي (17.3b، 17.3c، 17.3f، 17.3g، 17.4*).

### 7.5 بوابات عامة في كل PR

```bash
node scripts/check-backend-boundaries.mjs                  # exit 0
pnpm --filter=backend test -- <spec(s)>                    # exit 0
pnpm --filter=backend run test:e2e:critical                # exit 0
pnpm openapi:sync && git diff --exit-code -- apps/backend/openapi.json   # exit 0
pnpm test:premerge                                         # exit 0 (Node 22.12+، محلي)
git diff --check                                           # exit 0
```

---

## 8. المخاطر وخطة الرجوع

| # | الخطر | الأثر | التخفيف |
|---|---|---|---|
| R1 | إعادة ترتيب عبارة داخل المعاملة | سباق، فاتورة مزدوجة، رصيد سالب | دالة لكل عبارة؛ الاستدعاء في نفس الموضع؛ اختبار وحدة يثبت الترتيب؛ مراجعة diff سطرًا بسطر |
| R2 | نقل قفل أو إضافة قفل جديد | deadlock أو كسر `NOWAIT` → 409 | الأقفال تُنقل دون تغيير ترتيب أو نوع؛ لا قفل جديد في أي دالة |
| R3 | إضافة قاعدة عمل «تحسينية» | تغيير سلوك صامت (مثل تحصين `maxUses`) | ثابت التصميم §3.4 + اختبار صريح على الشكل الحالي |
| R4 | تغيير رسالة/نوع خطأ | كسر تجربة المستخدم أو تعاقد الـAPI | ثابت §3.5؛ اختبارات موجودة تتحقق من الرسائل |
| R5 | `delete-booking` مسار مالي هدّام | حذف بيانات مالية | PR مستقل + موافقة مالك + `invoice-delete-race` + `booking-delete-finance-lock-order` |
| R6 | دورة وحدات عند `FinanceModule → BookingsModule` | فشل bootstrap أو `forwardRef` جديد | `PackageLedgerModule` مستقلة داخل bookings؛ اختبار وحدة يبني الوحدة |
| R7 | عمى الفحص تجاه `$executeRaw` | «صفر» كاذب في 17.4c | الدالة 6 تملك العبارة الخام؛ `rg` يدوي في وصف PR |
| R8 | حذف سطر baseline لم يُصلح | إخفاء دين (الفحص لا يكتشفه لأنه يرى مدخلًا ناقصًا = stale فقط عند بقائه) | كل حذف مربوط باستبدال في نفس PR؛ `git diff` للملف يجب أن يكون حذفًا فقط وبعدد = عدد الاستدعاءات المستبدلة |
| R9 | كسر specs بسبب توقيع constructor | فشل بناء/تشغيل | تحديث الـspec في نفس PR؛ أو حقن الخدمة عبر provider اختياري غير مطلوب إذا تعذّر |
| R10 | تعارض مع MNT-18 على نفس الملفات | تعارض دمج | الترتيب في §6؛ لا لمس `refund-payment`/`moyasar-*` |

### خطة الرجوع

- **لا migrations ولا تغيير schema ولا تغيير عقد** في أي مرحلة → الرجوع لا يحتاج أي عملية قاعدة بيانات.
- **17.1a/17.1b** كود جديد غير مستخدم: `git revert` بلا أثر سلوكي.
- **17.3x/17.4x** كل PR يستبدل موضعًا واحدًا: `git revert <merge-sha>` يعيد العبارة الأصلية ويُعيد سطر baseline الواحد. يجب أن يُعيد الـrevert أيضًا سطر baseline — تحقّق `node scripts/check-backend-boundaries.mjs` بعد الرجوع.
- **بعد أي revert:** أعد تشغيل `pnpm --filter=backend run test:e2e:critical` على SHA الرجوع، وسجّل النتيجة في الـPR.
- **فشل Moyasar sandbox (17.5):** أوقف الدمج، لا تُدخل إصلاحًا داخل PR الترحيل؛ أصلح في PR منفصل وأعد التحقق.

---

## 9. ما لم يُنفَّذ في هذه المرحلة (حدود صريحة)

- لم يُنشأ أي ملف تحت `apps/backend/src/**`.
- لم يُعدَّل `openapi.json`، ولا `scripts/backend-boundaries-baseline.json`، ولا `.github/**`، ولا `AGENTS.md`/`CLAUDE.md`.
- لم يُشغَّل `--write-baseline`.
- لم تُشغَّل `pnpm test:premerge` ولا `test:e2e:critical` ولا Moyasar sandbox — لا كود تغيّر، وأي ادعاء عن سلامة سلوكية بعد الترحيل يبقى مؤجلًا إلى أدلة PRs 17.1+.
- لم يُثبَّت قرار ملكية جداول الباقات (5.2) — يحتاج موافقة مالك في PR 17.1b.

---

## 10. الملفات المرجعية

- [الهاند أوف الأصلي](./MNT-17.md)
- [قواعد العمل وترتيب الموجات](./README.md)
- [خطة الصيانة](../../plans/maintainability-roadmap.md)
- [سياسة النشر](../../operations/deployment-policy.md)
- [ميثاق الترحيل](../../operations/migration-charter.md)
- `scripts/check-backend-boundaries.mjs`
- `apps/backend/src/modules/finance/finance.module.ts`
- `apps/backend/src/modules/bookings/bookings.module.ts`
