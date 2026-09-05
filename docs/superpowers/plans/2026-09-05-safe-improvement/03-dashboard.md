# Dashboard Compatibility and Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Preserve the existing interaction design and verify behavior with the real backend at the integration gate.

**Goal:** إغلاق P2-01 وP2-02 وP2-03 وP2-06، مع إبقاء الصفحات والأزرار مألوفة.

**Architecture:** response adapter واحد عند API، ومصفوفة invalidation مشتركة، وendpoint تجميعي إضافي خلف المخطط الموجود. نستخدم عميل الشبكة والمصادقة الحاليين.

**Tech Stack:** Next.js 15، React 19، TanStack Query، OpenAPI، Vitest، Playwright.

**Spec:** [التصميم](/Users/tariq/code/sawaa/docs/superpowers/specs/2026-09-05-safe-improvement-design.md). [بوابات التكامل](/Users/tariq/code/sawaa/docs/superpowers/plans/2026-09-05-safe-improvement-plan.md).

## Global Constraints

تطبق Global Constraints في التصميم والخطة الرئيسية، وبالأخص:

- تبقى الصفحات والمسارات والقائمة الجانبية وترتيب النماذج والأزرار الأساسية وأسماء الأعمال مألوفة؛ العربية وRTL والترجمة الحالية إلزامية.
- كل تغيير endpoint/DTO يصاحبه pnpm openapi:sync، ومراجعة packages/api-client اليدوي إذا كان مستهلكًا للعقد.
- build وdashboard typecheck يعملان بالتتابع، وليس بالتوازي، لمنع سباق .next/types.
- المصادقة والصلاحيات وCASL ودلالات التوكن لا تتغير ضمن إعادة التنظيم؛ أي تغيير فيها يحتاج نطاقًا واعتمادًا صريحين.

## D1 / PR09 — تحديث البيانات المرتبطة وReset

**الملفات:**

- Create: `apps/dashboard/lib/query-invalidation.ts` — pure selection of affected keys + invalidation؛ لا React hooks في lib.
- Modify: `apps/dashboard/hooks/use-payments.ts` و`use-invoices.ts` و`use-credit-bookings.ts`، والمستهلكون الماليون المتأثرون حسب المصفوفة أدناه.
- Modify: `apps/dashboard/lib/query-keys.ts` لإضافة مفاتيح missing scopes فقط؛ لا إعادة تسمية جماعية للكاش.
- Test: `apps/dashboard/test/unit/hooks/use-payments.spec.tsx` و`use-invoices.spec.ts` و`use-credit-bookings.spec.tsx`، وCreate `apps/dashboard/test/unit/lib/query-invalidation.spec.ts`.
- Modify E2E: `apps/dashboard/e2e/flows/finance/invoice-payment-status-matrix.spec.ts`.

**العقد:**

```ts
export type MutationImpact =
  | { kind: 'payment-settled' | 'payment-refunded'; invoiceId: string;
      bookingId?: string; clientId?: string; employeeId?: string }
  | { kind: 'credit-booked' | 'credit-returned'; clientId: string;
      employeeId: string; date: string; bookingId?: string };
export function invalidateMutationImpact(
  client: QueryClient, impact: MutationImpact,
): Promise<void>;
```

استعمال QueryClient type من TanStack في lib مسموح كطبقة بيانات؛ لا استيراد hook أو component. اختيار المفاتيح يعتمد على factory الموجودة، لا string keys منتشرة.

| العملية | مفاتيح الأثر |
|---|---|
| collect/verify payment | payments، invoice detail/list، booking detail/list إن وجد، dashboard/reports التي تعرض المال |
| refund | السابق + client financial view؛ slots/credits فقط إذا أدى workflow الحالي فعلًا إلى إلغاء/إرجاع رصيد |
| book from credit | bookings، packagePurchases للعميل، matchingCredits، employee slots/schedule لليوم، packageReports المتأثرة |
| return credit/cancel | booking/program المتأثر، matchingCredits/purchases، slot، invoice/payment فقط إن تغيرا فعليًا |

إذا لم يُرجع العقد bookingId/clientId، يمكن اشتقاقه من المتغيرات أو بيانات invoice المعروفة؛ لا اختلاق IDs. يستخدم نطاق entity الأوسع عند تعذر الدقة، دون `queryClient.clear()` الذي يمس الجلسة وكل الشاشات.

- [ ] **D1.1 — اختبار QueryClient حقيقي.** خزّن invoice قديمة واركب hook مصرفًا لها، نفذ verify/refund، وأعد API state الجديدة. `waitFor` يثبت أن عنصر الواجهة صار PAID/REFUNDED مع المبلغ الصحيح، لا مجرد spy على invalidateQueries.
- [ ] **D1.2 — تحقق من غير النشط.** invoice query غير mounted تصبح invalidated ثم تستعيد القيمة الجديدة عند استعمالها. لا تعتمد على staleTime=5 دقائق كجدول تحديث؛ إعداد refetchOnMount=false يستلزم refetch صريحًا للكيان المتأثر/السياسة المحلية المناسبة.
- [ ] **D1.3 — نفذ helper وأعد استعماله.** يعيد Promise لجميع invalidations المطلوبة. لا optimistic update للمال أو تأكيد الحجز من نتيجة دفع فقط؛ حالة invoice قد تسبق consumer الحجز.
- [ ] **D1.4 — عالج التأخر الطبيعي للحدث.** بعد حفظ الدفع، جلب الحجز قد يسبق استهلاك outbox. استخدم إعادة جلب محدودة للحجز المتأثر كل ثانيتين، حتى انتقال الحالة المتوقع أو30 ثانية، ثم أوقف الحلقة واعرض حالة الحجز المؤكدة وآلية التحديث الموجودة. النجاح المالي يبقى نجاحًا؛ لا زر «أعد الدفع» لعلاج تأخر الحجز. الرسالة المحدودة إن لزمت: «تم حفظ الدفعة، وجارٍ تحديث حالة الموعد». ألغِ polling عند unmount/logout، ولا تحوّله إلى polling لكل التطبيق.
- [ ] **D1.5 — أصلح Reset.** في resetFilters الحالي أضف `setSearch('')` مع التاريخ والطريقة والحالة وpage=1؛ افحص debounce حتى لا يعيد آخر نص بحث بعد reset. لا تغيير لشكل أداة التصفية.
- [ ] **D1.6 — اختبارات مستهدفة.**

```bash
pnpm --filter=dashboard test -- test/unit/hooks/use-payments.spec.tsx test/unit/hooks/use-invoices.spec.ts test/unit/hooks/use-credit-bookings.spec.tsx test/unit/lib/query-invalidation.spec.ts
```

المتوقع: رصيد وslots محدثان بعد حجز الرصيد، وReset يزيل كل الفلاتر، وpayment محفوظ مع eventual booking transition. فشل API يعرض error ولا يعدل المبلغ محليًا. لا يلزم اختبار عشرات تفاصيل setter لنفس السلوك.

**الطرح:** تغيير frontend متوافق مع backend الحالي؛ تختبر نسخة API القديمة والجديدة. تراجع frontend لا يعكس أي عملية مالية محفوظة.

## D2 / PR10 — الفصل بين Booking HTTP response وview model

**الملفات:**

- Modify: `apps/backend/src/api/dashboard/bookings.controller.ts` وإضافة response DTO إذا غاب التوثيق الدقيق؛ لا تغيير wire enum الحالي.
- Create: `apps/backend/src/api/dashboard/dto/booking-response.dto.ts` و`.spec.ts` وفق شكل mapper الفعلي.
- Reuse/verify: `apps/backend/src/modules/bookings/booking-row.mapper.ts` و`.spec.ts`.
- Modify: `apps/dashboard/lib/api/bookings.ts` و`apps/dashboard/lib/types/booking.ts`.
- Create: `apps/dashboard/lib/api/booking-response.adapter.ts`.
- Test: `apps/dashboard/test/unit/lib/bookings-api.spec.ts` وCreate `booking-response.adapter.spec.ts` في المجلد نفسه؛ أي تعديل delivery display يغطى بالاختبارات الحالية للأعمدة.
- Generated integration ownership: `apps/backend/openapi.json` و`apps/dashboard/lib/types/api.generated.ts`.

**العقد:** response type مشتق من OpenApiResponse لا copy يدوي. تبقى view model الحالية: `type='individual'|'group'|'walk_in'` وdeliveryType uppercase. adapter يحول response wire `in_person` إلى individual، وقناة `in_person|online` إلى `IN_PERSON|ONLINE`. request serializer يبقى مستقلًا عن response adapter ويستخدم enums الـDTO الفعلية.

```ts
import type { OpenApiResponse } from './openapi';
import type { Booking } from '../types/booking';
export type BookingWireResponse = OpenApiResponse<
  '/api/v1/dashboard/bookings/{id}', 'get'
>;
export function toBookingViewModel(wire: BookingWireResponse): Booking;
```

هذا العقد يعتمد توثيق DTO في D2 أولًا. لا يستخدم النوع المستخرج قبل إصلاح response schema المفقودة، ولا يجعل وجود path وحده إثباتًا لصحة الحقول.

مثال test داخل fixture كاملة مأخوذة من mapper، لا casting fixture ناقصة بـ`as Booking`:

```ts
const view = toBookingViewModel(wireFixture);
expect(wireFixture.type).toBe('in_person');
expect(view.type).toBe('individual');
expect(view.deliveryType).toBe('IN_PERSON');
expect(view.id).toBe(wireFixture.id);
expect(view.invoice?.total).toBe(wireFixture.invoice?.total);
```

تطابق مسار invoice في fixture مع response الحقيقي قبل اعتماد المثال؛ لا تُضاف قيمة صفرية لتغطية missing/null. يحافظ adapter على dates/nullability/halalas/historicalPayment/packageFunding وغياب host URLs المصرح به.

- [ ] **D2.1 — التقط عقدًا حقيقيًا صناعيًا.** response من Nest+mapper لindividual/group/walk-in وonline/in-person، وحجز تاريخي/رصيد/عربون. أثبت فرق النوع الحالي باختبار boundary.
- [ ] **D2.2 — وثق DTO من الـresponse.** لا تستخدم request DTO لوصف response، ولا تغير enum Prisma أو wire الحالي لتجميل TS. صرّح nullable dates والحقول الاختيارية كما هي، ولا تجعل `as unknown as` يحل التعارض.
- [ ] **D2.3 — نفذ adapter في list/detail ومخرجات mutations التي تعيد Booking.** جميع المداخل لنفس view model تمر بالمحول مرة واحدة. unknown enum يعطي خطأ عقد قابلًا للرصد دون بيانات حساسة، ولا يصنف نوعًا مجهولًا فرديًا بالتخمين.
- [ ] **D2.4 — حافظ على create/reschedule.** التحويل من تاريخ الرياض إلى ISO والـrequest uppercase الصحيحان يبقيان منفصلين؛ اختبار round-trip يثبت عدم تحويل `individual` إلى wire response في طلب الكتابة بالخطأ.
- [ ] **D2.5 — زامن العقود واختبر.**

```bash
pnpm openapi:sync
pnpm --filter=dashboard test -- test/unit/lib/bookings-api.spec.ts test/unit/lib/booking-response.adapter.spec.ts
pnpm check:dashboard-api-drift
pnpm check:api-client-drift
```

المتوقع: لا endpoint قديم مفقود، money/identity values ثابتة، أيقونات/أنواع صحيحة، وwebsite/mobile مستمران بwire القديم. يسلم PR واحد snapshot وgenerated وadapter المتطابقين؛ `packages/api-client` يدوي ويُراجع مستقلاً.

## D3 / PR11 — مخطط الموظف يشمل كامل الفترة

**الملفات:**

- Create: `apps/backend/src/api/dashboard/employee-booking-analytics.controller.ts` و`.spec.ts`.
- Create: `apps/backend/src/modules/bookings/employee-booking-analytics/employee-booking-analytics.handler.ts` و`.spec.ts` و`employee-booking-analytics.dto.ts`.
- Modify: `apps/backend/src/modules/bookings/bookings.module.ts` لتسجيل controller/handler.
- Create: `apps/dashboard/lib/api/employee-booking-analytics.ts` و`apps/dashboard/hooks/use-employee-booking-analytics.ts`.
- Modify: `apps/dashboard/components/features/employees/employee-bookings-chart.tsx` و`apps/dashboard/lib/query-keys.ts`.
- Create: `apps/dashboard/test/unit/features/employees/employee-bookings-chart.spec.tsx` و`apps/backend/test/e2e/bookings/employee-booking-analytics.real-e2e-spec.ts`.

**واجهة إضافية مقترحة:** `GET /api/v1/dashboard/employees/:employeeId/booking-analytics?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`. ترجع aggregates فقط، لا أسماء عملاء أو ملاحظات. dateTo واجهة inclusive كما في الاستخدام الحالي، ويحول داخليًا إلى نهاية حصرية لليوم التالي في الرياض.

```ts
interface EmployeeBookingAnalytics {
  fromDate: string;
  toDate: string;
  totalBookings: number;
  byType: Array<{ type: 'in_person' | 'group' | 'walk_in'; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byDay: Array<{ date: string; count: number; amount: number }>;
  totalAmount: number; // halalas; current chart measure, defined below
}
```

حالة string في sketch تستبدل في DTO بإحصاء Booking status الفعلي الموثق. لا تستنتج «إيراد نقدي» من اسم totalAmount: الحساب الحالي للمخطط يجمع `b.payment.totalAmount` حين `b.payment.status==='paid'` من representative payment لكل حجز، ضمن تاريخ الموعد. ينقل D3 هذه الدلالة حرفيًا مع fixture مرجعية كي لا يغير معنى المؤشر خلسة. تحويله إلى net cash مع العربون والاسترداد يحتاج اعتماد قاموس المؤشرات المالي في B0، ويطبق كفرق أعمال معلن إذا اختير. ليس استبداله بسعر الخدمة أو invoice.total تحسينًا مكافئًا.

- [ ] **D3.1 — اختبار201+ حجز.** 250 حجزًا في فترة واحدة بأنواع وحالات مختلفة ومع حجزين خارج الفترة؛ مجموع byType وbyStatus وbyDay يساوي totalBookings للفترة. chart لا يطلب limit200 ولا يختفي الفردي. اختبر عدة دفعات لحجز واحد لضمان عدم multiplicative join.
- [ ] **D3.2 — authorization مطابق للقراءة الحالية.** `@CheckPermissions({ action: 'read', subject: 'Booking' })` وCaslGuard وJWT الحاليان، مع نفس employee ownership/filter resolver من قائمة الحجوزات. permission Employee.read وحدها لا تفتح بيانات Booking لمستخدم لم يكن يقرأها. اختبر موظفًا يطلب employeeId آخر وبدون permission، بنفس رفض/تقييد المسار الحالي.
- [ ] **D3.3 — نفذ aggregation على الخادم.** SQL parameterized/groupBy، نفس scopes والفترة لكل المقاييس، وعدم تحميل حجوزات كاملة إلى Node. عند latest-payment projection استخدم اختيارًا واحدًا حتميًا لكل حجز قبل aggregate، مطابقًا mapper الحالي. أضف index فقط إن أثبت EXPLAIN الحاجة.
- [ ] **D3.4 — wire endpoint ثم client.** زامن OpenAPI، وأضف `queryKeys.employees.bookingAnalytics(employeeId, fromDate, toDate)` بمفتاح موحد؛ الرسوم ذات الفترة نفسها تشترك في Query واحدة. تبقى فلاتر كل رسم مستقلة كما هي.
- [ ] **D3.5 — حافظ على الرسم والنصوص.** نفس Card وPeriodSelector والألوان والأحجام. تضم كل الحالات الصالحة دون فجوة بين إجمالي الدائرة ومجموعها؛ يمكن جمع awaiting/group-fill تحت التسمية الحالية pending، وإظهار deposit/expired بتسمية مترجمة عند وجودها، دون حذف counts. لا تعرض error الشبكة على أنه «لا توجد حجوزات».
- [ ] **D3.6 — شغل القبول.**

```bash
pnpm --filter=backend run test:e2e:real -- test/e2e/bookings/employee-booking-analytics.real-e2e-spec.ts
pnpm --filter=dashboard test -- test/unit/features/employees/employee-bookings-chart.spec.tsx
```

اختبر منتصف الليل بالرياض، فترات1/3/6 أشهر، صفر سجلات، حالة تحميل/خطأ وإعادة المحاولة. صورة fixture ≤200 تطابق المظهر الأساسي السابق؛250 تثبت الاكتمال. لا fallback صامت إلى200 عند فشل endpoint الجديد؛ طرح backend يسبق frontend.

## D4 / PR12 — استكمال العقود الحساسة بالتدريج

**الملفات:**

- Modify أولًا: `apps/dashboard/lib/api/payments.ts` و`invoices.ts` و`bookings.ts`، وأنواعها المستخدمة، عبر `apps/dashboard/lib/api/openapi.ts` الحالي.
- Modify: `apps/backend/src/api/dashboard/finance.controller.ts` و`refunds.controller.ts` و`bookings.controller.ts` مع response DTOs المجاورة الناقصة فقط.
- Modify generated: `apps/backend/openapi.json` و`apps/dashboard/lib/types/api.generated.ts`؛ تحديث `packages/api-client` يدويًا حيث يستهلك العقد، بعد قراءة تعليماته.
- Test: `apps/dashboard/test/unit/lib/payments-api.spec.ts` و`invoices-api.spec.ts` و`bookings-api.spec.ts`؛ API/DTO backend tests المقابلة.

**الناتج:** request/response مشتقان من snapshot للمسارات الحساسة، مع view models إن اختلفت الشاشة، وcontract fixtures من Nest الفعلي. ليس الهدف إعادة كتابة كل41 ملفًا دفعة واحدة أو رفع percentage شكلية.

- [ ] **D4.1 — سجل route/method/body/response لكل mutation مالية.** compare return type بالـJSON الفعلي؛ idempotency header/status codes/null/halalas والإخفاقات جزء من العقد. يضم refund PROCESSING/MANUAL_REVIEW ولا يصورها دائمًا نجاحًا نهائيًا.
- [ ] **D4.2 — أضف tests boundary.** أرسل payload صحيحًا وآخر به field زائد وamount string/number تحت production validation؛ تأكد مما يقبله DTO فعليًا. error409/result idempotent/retry وnullable bookingId للباقات جزء من tests.
- [ ] **D4.3 — انقل عميلًا واحدًا في المرة.** OpenApiRequestBody/OpenApiResponse الحاليان، دون custom fetch جديد أو auth refresh آخر. أبقِ headers/base URL/cookies/abort/error normalization الحالية. لا `any` أو casting لإخفاء missing DTO.
- [ ] **D4.4 — قلص baseline عند إصلاحه فقط.** الـ151 gaps في المراجعة ديون معروفة، وليست كلها مطلوبة في هذا الإصدار. تمنع CI gaps جديدة، وتزيل من baseline فقط endpoint الذي أصبح موثقًا ومختبرًا. ثبت صفر gaps في المسارات المالية والحجوزات التي تعدلها هذه الخطة.
- [ ] **D4.5 — تحقق المستهلكين.** old/new payload matrix، ومراجعة callsites website/mobile على العقود المشتركة؛ `pnpm --dir apps/mobile typecheck` عند التأثر. فحص drift method/path لا يعوض اختبار response/body.

**قبول الواجهة النهائي D1–D4:** حجز→تحصيل→عربون/باقي→استرداد→تقرير، واستخدام رصيد، ومخطط موظف، وReset، بنفس مواضع التحكم. بعد فقد جلسة تمسح بيانات المستخدم من cache كما في auth provider الحالي. لا تدخل وظائف جديدة أو تغيير هيكل التنقل ضمن هذا التحسين.
