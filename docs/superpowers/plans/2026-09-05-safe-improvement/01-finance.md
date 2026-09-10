# Safe Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans; use test-driven-development for behavior changes and verification-before-completion at gates. Steps use checkbox (`- [ ]`) syntax. No implementation is authorized by this planning document.

**Goal:** إغلاق P1-01 وP1-02 وP1-03 دون تغيير شاشة التحصيل أو السجلات التاريخية.

**Architecture:** دالة حساب نقية واحدة تستعملها handlers وread projections، مع أقفال الفاتورة الحالية. outbox الحالي جزء من معاملة الدفع. التقرير يفصل أصل التدفق والاسترداد.

**Tech Stack:** NestJS 11، Prisma 7/Postgres، BullMQ، Jest، Playwright، Moyasar sandbox.

**Spec:** [التصميم](/Users/tariq/code/sawaa/docs/superpowers/specs/2026-09-05-safe-improvement-design.md). [التكامل والنشر](/Users/tariq/code/sawaa/docs/superpowers/plans/2026-09-05-safe-improvement-plan.md).

## Global Constraints

تطبق جميع Global Constraints في التصميم والخطة الرئيسية. وبالأخص:

- المبالغ داخل النظام أعداد صحيحة بالهللة؛ تبقى وحدات التخزين الحالية، وVAT الافتراضي 0 مع حفظ قيم الفواتير التاريخية.
- تنفيذ تعديل مالي يحتاج اعتماد المالك، وdashboard smoke وMoyasar sandbox قبل نشر المسار المتأثر.
- لا تعديل لسعر فاتورة أو إيصال صادر أو snapshot تاريخية كوسيلة لإخفاء اختلاف محاسبي.
- لا تغيير لمفاتيح التشفير أو AAD أو أسرار مزودي الخدمة أو إعداداتهم الإنتاجية ضمن هذه الخطة.
- كل تغيير endpoint/DTO يصاحبه pnpm openapi:sync، ومراجعة packages/api-client اليدوي إذا كان مستهلكًا للعقد.

## F1 / PR02 — توحيد الرصيد وتقييد التحصيل

**الاعتماد:** B0 وO1 واعتماد سياسة الاسترداد. لا يبدأ F2 بالتعديل على هذه الملفات حتى إغلاق F1.

**الملكية والملفات:**

- Create: `apps/backend/src/modules/finance/invoice-balance.helper.ts` و`.spec.ts` — حسابات نقية؛ يستخدم money.helper الحالي للتحويل من Decimal.
- Modify: `apps/backend/src/modules/finance/process-payment/process-payment.handler.ts` و`collect-booking-payment/collect-booking-payment.handler.ts` — قرار التحصيل داخل القفل، دون تغيير idempotency fingerprint.
- Modify: `apps/backend/src/modules/finance/ensure-booking-invoice/ensure-booking-invoice.handler.ts` و`payments/client/init-client-payment/init-client-payment.handler.ts` — الرصيد وقرار إنشاء طلب جديد.
- Modify: `apps/backend/src/modules/finance/verify-payment/verify-payment.handler.ts` و`bank-transfer-upload/bank-transfer-upload.handler.ts` — الموافقة والحجز المالي إذا كانت الطريقة مفعلة.
- Modify: `apps/backend/src/modules/finance/moyasar-webhook/moyasar-webhook.handler.ts` و`apps/backend/src/modules/ops/cron-tasks/reconcile-payments.cron.ts` — settlement مثبت، دون تجاهل حقيقة المزود.
- Modify: `apps/backend/src/modules/finance/refund-payment/manual-refund-payment.handler.ts` و`refund-payment.handler.ts` — اشتقاق الرصيد والحالة مع بقاء provider lease/reconciliation كما هي.
- Inspect/modify فقط عند حساب الرصيد نفسه: `apply-invoice-discount/apply-invoice-discount.handler.ts` و`apply-coupon/apply-coupon.handler.ts` و`issue-invoice-receipt/build-invoice-pdf-data.ts` وقراءات invoices في `modules/bookings`.
- Test: المواصفات المجاورة للـhandlers، وCreate `apps/backend/test/e2e/finance/invoice-balance-concurrency.real-e2e-spec.ts`.

**العقد المقترح — الأسماء مشتركة بين المهام:**

```ts
export interface InvoiceBalanceInput {
  invoiceTotal: number;       // integer halalas after the stored discount/VAT
  grossSettled: number;       // original amounts of successfully settled payments
  refundedSettled: number;    // cumulative completed refunds; counted once
  reservedPending: number;    // active reservations, excluding the settling row
  newCollectionBlocked: boolean; // approved invoice/booking/refund policy
}
export interface InvoiceBalance {
  netSettled: number;
  outstanding: number;
  availableToCollect: number;
  overCollected: number;
}
export function calculateInvoiceBalance(input: InvoiceBalanceInput): InvoiceBalance;
```

شكل العملية الحسابية الملزم:

```ts
const netSettled = grossSettled - refundedSettled;
const outstanding = Math.max(0, invoiceTotal - netSettled);
const availableToCollect = newCollectionBlocked
  ? 0 : Math.max(0, outstanding - reservedPending);
const overCollected = Math.max(0, netSettled - invoiceTotal);
```

الحدود: تُرفض المدخلات غير الصحيحة/غير الآمنة عدديًا أو السالبة؛ refundedSettled أكبر من grossSettled يسجل اختلافًا ويمنع بدء تحصيل، ولا يُخفى بـclamp. outstanding قيمة حسابية وليست تصريح تحصيل؛ availableToCollect هو حد العملية. لا تغيير لأسماء حقول HTTP القديمة أو معناها بصمت. لا إضافة balance fields جديدة للواجهة إلا بعقد إضافي مع D4.

- [ ] **F1.1 — ثبت اختبار الحساب على المثال المثبت.** أضف اختبارات الدالة، منها المثال التالي بالهللة، وحالة عدم وجود استرداد وحالة التحصيل الزائد السابق:

```ts
expect(calculateInvoiceBalance({
  invoiceTotal: 50_000, grossSettled: 50_000,
  refundedSettled: 20_000, reservedPending: 0,
  newCollectionBlocked: true,
})).toEqual({
  netSettled: 30_000, outstanding: 20_000,
  availableToCollect: 0, overCollected: 0,
});
```

إذا اعتمد المالك إعادة التحصيل: المثال نفسه مع blocked=false ينتج availableToCollect=20,000؛ ومحاولة 50,000 ترفض أيضًا. الدالة تدعم حساب القرار، لكن تطبيق الخيارين في الإنتاج ليس feature flag يغيره الموظف.

- [ ] **F1.2 — شغل الأحمر المستهدف.** `pnpm --filter=backend test -- src/modules/finance/invoice-balance.helper.spec.ts src/modules/finance/process-payment/process-payment.handler.spec.ts`. المتوقع فشل المثال الجديد قبل التنفيذ، لا فشل تهيئة أو اتصال خارجي.
- [ ] **F1.3 — نفذ الدالة ومدخلاتها.** اجمع أصل COMPLETED/PARTIALLY_REFUNDED/REFUNDED وفق ثبوت settlement؛ اجمع refundedAmount المكتمل مرة واحدة. تحقق من RefundRequest للمصالحة لا لخصم ثانٍ. افصل PENDING/FAILED/PROCESSING عن الإيراد. لا تعامل كل ظهور COMPLETED في المستودع كأنه حساب رصيد؛ بعضه شرط انتقال أو اختيار دفعة للاسترداد.
- [ ] **F1.4 — طبق الحماية داخل المعاملة.** اقرأ الفاتورة تحت FOR UPDATE، ثم الدفعات والحجوزات المالية والسياسة؛ افحص المبلغ من جديد قبل الكتابة. استبعد الدفعة التي تتم تسويتها من reservedPending، واحتفظ بالمحاولة الأخرى المحجوزة حتى تنتهي/تُلغى وفق مسارها الحالي. حافظ على ترتيب الأقفال الموجود في مسارات invoice/payment/refund وثبته باختبار deadlock؛ لا تضف ترتيبًا معكوسًا.
- [ ] **F1.5 — وصل كل مستهلك.** استبدل حساب الرصيد المكرر في ensure/init/process/verify/webhook/reconcile/refund/read projections. لا تغير ضمان استرداد الباقات أو حجز الرصيد. أثبت same-key replay لطلب مطابق و409 للمختلف، بما في ذلك خصم 100% دون Payment.
- [ ] **F1.6 — احمِ settlement الخارجي.** اختبر webhook يصل بعد refund/cancellation؛ يسجل حقيقة المزود وسبب التعارض للمراجعة. لا تأكيد لموعد غير قابل للتأكيد، ولا drop للدفعة، ولا refund تلقائي. عند نتيجة provider مجهولة يستخدم المسار الحالي للمصالحة، ولا يستأنف charge.
- [ ] **F1.7 — تحقق حقيقيًا.** نفذ الاختبار الجديد بعد تطبيق المهاجرات الحالية على قاعدة الاختبار المعزولة:

```bash
pnpm --filter=backend run test:e2e:real -- test/e2e/finance/invoice-balance-concurrency.real-e2e-spec.ts
```

يستخدم الاختبار اتصالين ومعاملتين على Postgres، لا mocked locks. الحالات: طلبان بمفتاحين على الرصيد الأخير؛ replay مطابق؛ partial/full refund؛ reservation قائمة ثم settlement؛ refund PROCESSING؛ حالة مزود مجهولة؛ deposit ثم remainder؛ 100% discount؛ مبلغ 1 هللة؛ طلب مبلغ سالب/كسري أو أكبر من الحد. المتوقع عدم تجاوز الرصيد وعدم إنشاء Payment ثانية في retry، وحفظ التعارض التاريخي كاستثناء ظاهر.

**قبول F1:** جميع مسارات إنشاء التحصيل والموافقة عليه تستخدم القاعدة نفسها؛ لا overcollection في اختبارات السباق؛ لا تغيير في units أو الفاتورة الأصلية. التراجع من التطبيق بعد writes لا يكون إلى إصدار يعيد فتح التحصيل الخاطئ؛ يلزم إصدار توافق آمن أو forward-fix.

## F2 / PR03 — outbox للدفع اليدوي

**الملفات:**

- Modify: `apps/backend/src/modules/finance/process-payment/process-payment.handler.ts` و`collect-booking-payment/collect-booking-payment.handler.ts` بعد F1.
- Modify: `apps/backend/src/modules/finance/events/payment-completed.event.ts` و`deposit-paid.event.ts` — constructor يقبل eventId اختياريًا مع بقاء callers الحالية صحيحة.
- Reuse: `apps/backend/prisma/schema/ops.prisma`، `apps/backend/src/modules/ops/cron-tasks/outbox-publisher.cron.ts`، `apps/backend/src/common/events/base-event.ts`.
- Test: المواصفات المجاورة وCreate `apps/backend/test/e2e/finance/manual-payment-outbox.real-e2e-spec.ts`.
- Verify: `apps/backend/src/modules/bookings/payment-completed-handler/payment-completed.handler.ts` و`deposit-paid-handler/deposit-paid.handler.ts` وcomms consumers المتأثرة.

**العقد:**

```ts
// Backwards-compatible event constructor contract.
constructor(payload: PaymentCompletedPayload, eventId?: string)
constructor(payload: DepositPaidPayload, eventId?: string)
```

يُمرر eventId إلى BaseEvent. داخل المعاملة: `Payment + Invoice + PaymentCollectionIdempotency + Outbox`، أو لا شيء منها. envelope يحفظ eventName/version/correlation/source/occurredAt/payload نفسها التي يفهمها الناشر الحالي. لا تضاف أعمدة outbox بديلة أو direct-publish fallback.

- [ ] **F2.1 — اختبار الفشل بعد commit.** اجعل Redis/ناقل الاختبار غير متاح بعد كتابة المال، ثم كرر نفس المفتاح؛ المتوقع Payment واحدة وOutbox واحدة باقية، والاستجابة لا توحي بفشل التحصيل المحفوظ. الاختبار القديم الذي يتوقع broker exception من طلب ناجح ماليًا يُعاد حول الدلالة الجديدة.
- [ ] **F2.2 — اختبار rollback.** فشل إدراج outbox يُسقط المعاملة كلها؛ فشل collector لاحقًا داخل المعاملة الخارجية لا يترك دفعة أو outbox. هذا يثبت أن ProcessPayment يستخدم tx الذي مرره collector، ولا يفتح معاملة مستقلة.
- [ ] **F2.3 — نفذ الإدراج الذري.** أنشئ Event envelope مرة. Payment.id يصلح هوية للتسوية الواحدة بعد جرد المنتجين؛ يستخدم outbox.id نفسه لمنع تكرار الإدراج. سجل نوع الحدث عند الإنشاء ولا تعِد حسابه في replay. أبقِ مسار الخصم الكامل بلا Payment خارج اصطناع أحداث دفع.
- [ ] **F2.4 — مرر النشر إلى outbox فقط.** أزل النشر المباشر للحدث المالي من process/collector بعد نقل كل callers. أبقِ سجل النتيجة idempotent. يجوز wake-up غير مضمون للناشر لتقليل التأخير، لكن correctness لا تعتمد عليه.
- [ ] **F2.5 — اختبار إعادة التسليم.** crash بعد enqueue وقبل PUBLISHED، ثم إعادة الناشر، ثم consumer مرتين: انتقال الحجز مرة واحدة، لا مضاعفة قيد أو رصيد أو استرداد. احتفظ بهوية job/consumer المستقرة الموجودة. إذا كشف الاختبار مستهلكًا ماليًا غير idempotent، أصلحه ضمن نطاق الحدث قبل الشحن.
- [ ] **F2.6 — اختبار إشعارات محدود.** تحقق أن job identity لا تعيد إرسال الإشعار في retry الاعتيادي. وثق أن crash بعد اتصال SMS ناجح وقبل تسجيله قد يبقى ambiguous إذا لم يدعم المزود dedup؛ لا تعد exactly-once ولا تعِد رسائل قديمة ضمن R1. فشل enqueue مطلوب يجب أن يكون قابلًا للرصد، لا log صامت على أنه اكتمل.
- [ ] **F2.7 — شغل الاختبارات المستهدفة ثم real-DB.**

```bash
pnpm --filter=backend test -- src/modules/finance/process-payment/process-payment.handler.spec.ts src/modules/finance/collect-booking-payment/collect-booking-payment.handler.spec.ts src/modules/ops/cron-tasks/outbox-publisher.cron.spec.ts
pnpm --filter=backend run test:e2e:real -- test/e2e/finance/manual-payment-outbox.real-e2e-spec.ts
```

المتوقع: PENDING محفوظ عند تعطيل الناقل، يصبح PUBLISHED/مستهلكًا عند التعافي؛ FAIL لا يزيد المبلغ ولا عدد الدفعات. اختبر deposit/remainder/cancelled booking. لا تكتفِ بعدد `publish` calls على mock.

**طرح F2:** اختبر النسخة القديمة والجديدة من الناشر مع event envelope الجديد قبل rolling deploy. احترم deliveryLane وPENDING_V2 وleases. لا تغير كل FAILED إلى PENDING ولا تعيد replay المدفوعات التاريخية؛ R1 مسار منفصل.

## F3 / PR04 — تصحيح تقرير الإيرادات

**الملفات:**

- Modify: `apps/backend/src/modules/ops/generate-report/revenue-report.builder.ts` و`.spec.ts`.
- Modify عند الحاجة إلى عقد الفترة: `generate-report.dto.ts` و`generate-report.handler.ts` في المجلد نفسه، مع snapshot المتأثر عبر مسؤول التكامل.
- Create: `apps/backend/src/modules/ops/generate-report/revenue-report-query.helper.ts` و`.spec.ts` — بناء نطاق موحد للفرع/الموظف والفترة.
- Create: `apps/backend/test/e2e/finance/revenue-reconciliation.real-e2e-spec.ts`.

**العقد:** تبقى `RevenueReportResult` ومفاتيح `totalRevenue/netRevenue/refundsTotal/byMethod/byStatus/byDay/recentPayments` متوافقة. totalRevenue أصل settled cash ضمن الفترة المختارة، refundsTotal استردادات COMPLETED في الفترة، netRevenue الفرق. byStatus قد يصف حالات الدفعات؛ لا يُجمع على أنه cash إذا تضمن PENDING/FAILED. حساب متوسط الحجز يبقى بتعريفه المعتمد ولا يُعاد تسميته ضمن الإصلاح.

- [ ] **F3.1 — أضف حالات التقرير المثبتة.** استخدم دفعة تحولت فعليًا إلى PARTIALLY_REFUNDED، لا fixture يتركها COMPLETED مع refund منفصل:

```ts
expect(result.totalRevenue).toBe(10_000);
expect(result.refundsTotal).toBe(1_000);
expect(result.netRevenue).toBe(9_000);
```

أنشئ fixtures أخرى: full refund يعطي0؛ استرداد الشهر التالي يعطي صافيًا سالبًا صحيحًا لذلك الشهر؛ فرعان وموظفان؛ دفعة معلقة لا تدخل التحصيل؛ coupon redemption لفرع آخر لا يدخل الخصومات؛ refund PROCESSING لا يدخل المخصوم.

- [ ] **F3.2 — شغل الأحمر.** `pnpm --filter=backend test -- src/modules/ops/generate-report/revenue-report.builder.spec.ts`. المتوقع فشل 100−10 والفلاتر على السلوك السابق.
- [ ] **F3.3 — وحّد scope دون تحميل كل IDs.** استخدم relation invoice للاستردادات. CouponRedemption.invoiceId حقل دون Prisma relation؛ استخدم SQL join parameterized إلى Invoice عند التصفية، أو subquery مكافئة، وليس `prisma.couponRedemption` بفلتر علاقة غير موجود. يطبق الفرع والموظف على invoice snapshot نفسه في كل مجاميع المال.
- [ ] **F3.4 — أصلح مجموعة settled والحساب أولًا.** يحسب أصل الدفعات المستقرة بما فيها المستردة؛ تُخصم الطلبات المكتملة مرة واحدة. لا يعاد حساب invoice.total، ولا يكتب التقرير سجلات أثناء القراءة.
- [ ] **F3.5 — طبق قرار التاريخ من B0.** إذا بقي createdAt لا تغيره هنا. إن اعتمد processedAt، استخدم COALESCE(processedAt,createdAt) للقديم مع count صريح للسجلات fallback في دليل التقرير، دون backfill تخميني. حدود اليوم من timezone helpers الحالية في الرياض، لا UTC slice. لا تُظهر الرقم المصحح وكأنه خطأ إذا كان الاسترداد في فترة بلا تحصيل.
- [ ] **F3.6 — تحقق DB والمقارنة.**

```bash
pnpm --filter=backend run test:e2e:real -- test/e2e/finance/revenue-reconciliation.real-e2e-spec.ts
```

المتوقع تطابق مجموع اليوم مع إجمالي الفترة والطرق مع التحصيل ضمن نفس التعريف، وعدم تسرب أي خصم/استرداد من فرع آخر. مقارنة نسخة قديمة وجديدة على dataset صناعي تعزل الفرق المقصود فقط.

**الأثر والتراجع:** نفس التقرير والملفات المصدرة مع أرقام مصححة؛ وثق السبب للمستخدم عند التسليم. لا تغير الإيصالات الصادرة. عودة التقرير القديم قد تعيد أرقامًا خاطئة؛ يمكن حجب تقرير متأثر مؤقتًا بدل إعلان صحة رقم معروف الخطأ. تحسين الأداء الواسع في O4 بعد تثبيت صحة النتائج هنا.
