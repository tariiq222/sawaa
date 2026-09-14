> حالة التنفيذ: أُنجز محليًا. راجع [نتائج التحقق الفعلية](../evidence/2026-09-13-package-groups/local-verification.md) و[دليل القبول](../evidence/2026-09-13-package-groups/review-guide.md). تبقى القوائم أدناه سجل الخطة؛ تفاصيل ملفات التنفيذ الفعلية والحدود موثقة في التقرير.

# Package Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Coordinator: native Astra; bounded implementation: native Luna. This document does not authorize execution, commits, deployment, or production access.

**Goal:** باقات متعددة الممارسين بمجموعات وجلسات مفصلة وترتيب اختياري وخصم إجمالي، مع حفظ الحقوق القديمة.

**Architecture:** إضافة إصدار `GROUPED_V2` بجانب `LEGACY`. إعادة استخدام بنود الباقة والأرصدة: بند ورصيد بكمية واحدة لكل جلسة جديدة، مع مجموعات مستقلة ومواصفات مجمدة عند البيع. فصل دليل إنجاز الجلسة والتعيين الحالي للممارس عن تاريخ الاستخدام والقيمة المالية.

**Tech Stack:** NestJS 11, Prisma 7/PostgreSQL, Next.js 15/React 19, Zod, pnpm, Jest, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-package-groups-scope.md`؛ يقرأ المنفذ هذه الوثيقة والخطة معًا. مسارات الملفات أدناه نسبية إلى المستودع.

## Global Constraints

- لا وصول لقاعدة الإنتاج. الاستيج مسموح، والاختبارات التي تنشئ بيانات تستخدم قاعدة اختبار معزولة لا قاعدة العملاء.
- الهجرات إضافية فقط. لا حذف أو تعديل هجرات قديمة، ولا إعادة تسعير مبيع سابق.
- الجديد: `ORDERED` افتراضي لكل مجموعة. القديم: `LEGACY` دون فرض ترتيب أو اعتماد جديد.
- الممارس لكل مجموعة؛ DIRECT يستخدم الخدمة الداخلية للعيادة؛ المدة والحضور من خيارات الممارس المسجلة.
- تعديل سعر الجلسة داخل الباقة وخصم إجمالي واحد؛ لا حقل مستقل للمجانية في الإنشاء الجديد.
- عدم الحضور يرجع نفس الجلسة؛ الاسترداد الجزئي لا ينقص سعتها؛ لا انتهاء صلاحية للباقات.
- السعر والمواصفات المالية مجمدة عند البيع، بما فيها تهيئة الدفع قبل webhook. لا رسوم تبديل ممارس.
- حفظ الصلاحيات الحالية؛ لا تغيير guards أو CASL أو تكامل الدفع بلا النطاق والتفويض المناسبين.
- لا مسار عميل جديد للحجز من الرصيد ضمن هذه الخطة؛ نغطي مستهلكي دورة الحجز الموجودة في الموبايل والعامة.
- تحديث OpenAPI و`apps/dashboard/lib/types/api.generated.ts` وAPI client اليدوي معًا عند تغيير العقود.
- لا ادعاء نجاح من اختبارات skipped. المنسق يشغل الفحص المتكامل مرة بعد جمع كل حزمة؛ يمكنه تشغيل اختبارات مركزة لدورة red/green.

## العقود المقترحة قبل توزيع التنفيذ

الأسماء أدناه مقترحة للتنفيذ وليست موجودة حاليًا. حفظ الـ V2 يرفض حقول السعر/المالك القديمة المتعارضة بدل تجاهلها بصمت.

```ts
type PackageModelVersion = 'LEGACY' | 'GROUPED_V2';
type GroupSequenceMode = 'ORDERED' | 'UNORDERED';
type GlobalDiscount =
  | { type: 'NONE'; value: 0 }
  | { type: 'PERCENTAGE'; value: number }
  | { type: 'FIXED'; value: number }; // integer halalas
type PackageSessionInput = {
  key: string; position: number;
  durationOptionId: string;
  deliveryType: 'IN_PERSON' | 'ONLINE';
  unitPrice: number; // nonnegative integer halalas, package override
};
type PackageGroupInput = {
  key: string; label?: string;
  serviceId: string; employeeId: string;
  sequenceMode: GroupSequenceMode;
  dependsOnGroupKey: string | null;
  sessions: PackageSessionInput[];
};
type GroupedPackageInput = {
  modelVersion: 'GROUPED_V2';
  groups: PackageGroupInput[];
  globalDiscount: GlobalDiscount;
};
type PackageSessionAvailability = {
  creditId: string; groupId: string; sessionPosition: number;
  bookable: boolean;
  reason: null | 'PREDECESSOR_INCOMPLETE' | 'GROUP_INCOMPLETE'
    | 'RESERVED' | 'DELIVERED' | 'REFUNDED' | 'OFFERING_UNAVAILABLE';
};
```

إحداثيات خدمة/ممارس/مدة/حضور تتحقق من جدول offering الفعلي، بما في ذلك override المدة. مدة التنفيذ بالدقائق وسعر القائمة والسعر المعتمد واسم الخدمة والممارس تحفظ في نسخة البيع؛ المرجع وحده لا يكفي إذا تعدل الكتالوج لاحقًا. مفتاح المجموعة المستقر يحول إلى ID عند الحفظ، وروابط الاعتماد لا تستخدم رقم صف في الواجهة.

تظل DTOs القديمة مقبولة للباقات LEGACY فقط. في V2 تكون الباقة بلا مالك عام، وحقول المجموعة مصدر اختيار الممارس. إعداد «جلسات متطابقة × N» في الواجهة ينتج N جلسة؛ لا نخلط كمية داخل الجلسة مع عدد جلسات المجموعة.

## الحزم وتسلسل الاعتماد

| الحزمة | الناتج القابل للمراجعة | الاعتماد وملكية العمل |
|---|---|---|
| 1. النموذج والتوافق | مخطط وعقود V2 مع تشغيل القديم دون تغيير | أولًا؛ المنسق يملك العقود والهجرات والمخرجات المولدة |
| 2. تعريف الباقة وبيعها | تحقق كتالوج وتسعير إجمالي ونسخة بيع كاملة | بعد 1؛ تنفيذ Luna في org-experience وfinance |
| 3. الحجز ودورة الجلسة | منع القفز وإعادة نفس الجلسة وتبديل الممارس | بعد 1 ونسخة البيع من 2؛ Luna في bookings |
| 4. المحرر وشاشات الرصيد | إنشاء ومراجعة وحجز واضح بالعربية | بعد تثبيت عقود 1 و2؛ يمكن بالتوازي مع 3، بملكية dashboard منفصلة |
| 5. التقارير والتوافق المالي | قيم صحيحة وتاريخ ممارس محفوظ | بعد 2 و3؛ لا يعيد كتابة الماضي |
| 6. أداة تحويل القوالب | dry-run وتصنيف وتطبيق قائمة معتمدة | بعد 1 و2؛ مستقل عن محرر الواجهة، لا يحول المبيعات تلقائيًا |
| 7. التحقق والاستيج | الأدلة والاختبارات ومعاينة المستخدم | بعد دمج 2–6 محليًا؛ المنسق فقط |

هذه حدود حزم مراجعة، وليست إذنًا بسبعة PRs أو توزيع تنفيذ الآن. يجب إبقاء بيع V2 معطلًا حتى تتوفر الحزم التي تحمي حجزه وتقاريره.

## 1 — المخطط وقراءة النسختين

**Modify:** `apps/backend/prisma/schema/organization.prisma`, `apps/backend/prisma/schema/bookings.prisma`, `packages/shared/types/session-package.ts`, `packages/shared/schemas/session-package.ts`, `packages/api-client/src/types/session-package.ts`.

**Create:** migration جديدة باسم ينتهي بـ`add_package_groups_v2`، و`packages/shared/schemas/session-package-v2.ts`، و`apps/backend/src/modules/org-experience/session-packages/package-group-policy.ts` مع `.spec.ts`.

**Storage contract:** `SessionPackage.modelVersion` افتراضي LEGACY؛ `SessionPackageGroup` يحمل packageId، خدمة، ممارس، sequenceMode، dependsOnGroupId وsortOrder. `SessionPackageItem.groupId` اختياري و`sessionPosition` اختياري؛ في V2 الكمية 1 مدفوعة و0 مجانية وخصم البند محايد، والسعر الصفرى مسموح. `PackagePurchase` يحمل نسخة سياسة/snapshot؛ `PackagePurchaseGroup` يثبت المجموعة والاعتماد؛ `PackageCredit` يحمل purchaseGroupId وsessionPosition. تضيف `PackageCreditUsage.consumedAt` و`deliveredAt` اختيارية للجديد؛ القيم التاريخية لا تملأ من `usedAt` تلقائيًا. إضافة أحداث تعيين الممارس مع actor/reason/from/to/creditId بدون تعديل أحداث سابقة.

**Produces:** `validateGroupGraph(groups: PackageGroupInput[]): void`؛ يرفض التكرار والرابط خارج الباقة والدائرة والمواضع الناقصة. unique(groupId,sessionPosition)، وكل جلسة V2 ذات حق واحد؛ روابط LEGACY تظل null.

- [ ] اكتب اختبارًا يفشل: A يعتمد على B وB على A؛ التوقع خطأ `PACKAGE_GROUP_CYCLE`. واختبار A مستقل وB يعتمد عليه ينجح.
- [ ] أثبت فشل الاختبار قبل التنفيذ ثم أضف التحقق، مثل مسح DFS بثلاث حالات (unvisited/visiting/visited)، وليس مقارنة ربط مباشر فقط.
- [ ] أضف migration جديدة ثم شغلها على قاعدة اختبار فارغة وعلى قاعدة اختبار فيها سجل LEGACY. قارن `amountPaid`, `totalQuantity`, `usedQuantity`, `reservedQuantity`, القيود والحركات قبل/بعد، يجب تطابقها.
- [ ] شغل `pnpm --filter=backend run prisma:validate` و`pnpm --filter=backend test -- package-group-policy.spec.ts` من المنسق. راجع المخطط قبل بدء الحزم التابعة.

## 2 — التحقق والتسعير والبيع

**Modify:**

- `apps/backend/src/modules/org-experience/session-packages/create-session-package/{create-session-package.dto.ts,create-session-package.handler.ts}` ونظيرها في `update-session-package`.
- `apps/backend/src/modules/org-experience/session-packages/package-owner.helper.ts`: إبقاؤه لمسار LEGACY؛ لا توريث عام في V2.
- `apps/backend/src/modules/org-experience/compute-package-price.service.ts`، ومعالجات get/list العامة ولوحة الإدارة.
- `apps/backend/src/modules/finance/package-purchases/package-credit-snapshot.ts` ومعالجات create/init/activate-package-purchase.

**Create:** `apps/backend/src/modules/org-experience/session-packages/package-group-pricing.ts` و`.spec.ts`، و`package-group-offering.helper.ts` و`.spec.ts`.

**Produces:** `allocateSessionNet(prices: number[], discount: GlobalDiscount): { subtotal: number; discountAmount: number; amountPaid: number; sessionNet: number[] }`. يوزع الصافي بنسبة السعر المعتمد لكل جلسة بعد override، باستعمال حساب صحيح ثم توزيع البواقي حسب أكبر كسر مع ترتيب مستقر عند التعادل. لا يعيد استعمال تقدير LEGACY لتسعير V2. أسعار القائمة للعرض والمقارنة فقط.

```ts
expect(allocateSessionNet([30000,15000,20000,25000],
  {type:'PERCENTAGE',value:10})).toEqual({
  subtotal:90000,discountAmount:9000,amountPaid:81000,
  sessionNet:[27000,13500,18000,22500],
});
expect(allocateSessionNet([1,1,1], {type:'FIXED',value:1}).sessionNet)
  .toEqual([1,1,0]);
```

- [ ] اكتب وشغل اختبارات فاشلة للأسعار السابقة، وخصم 100%، وصفر، وخصم يتجاوز الإجمالي (يرفض)، وأعداد كسرية/سالبة (ترفض). أثبت أن ΣsessionNet=amountPaid دائمًا.
- [ ] تحقق من خدمة DIRECT الداخلية ومن خدمة داخل SERVICES، ومن offering كل ممارس ومدته وحضوره. تعديل الممارس في المحرر لا يبقي durationOption غير صالح.
- [ ] احفظ البيع ونسخة المجموعات والجلسات والقيم وإصدارها في معاملة واحدة. يثبت مسار الدفع النسخة قبل التهيئة؛ التفعيل لا يعيد حساب V2 من القالب.
- [ ] اختبر بدء دفع ثم تعديل/أرشفة القالب ثم التفعيل: النسخة المباعة ثابتة، وإعادة webhook لا تصدر جلسات ثانية. PENDING قديم بلا snapshot صحيح يصنف للمراجعة ولا يخمن نسخة V2.
- [ ] شغل اختبارات `package-group-pricing.spec.ts` و`create-package-purchase.handler.spec.ts` و`init-package-purchase.handler.spec.ts` و`activate-package-purchase.handler.spec.ts`. أي تغيير لتكامل Moyasar نفسه يحتاج تغطية sandbox قبل القبول.

## 3 — إتاحة الجلسة ودورة الحجز والتبديل

**Create:** `apps/backend/src/modules/bookings/package-session-eligibility.helper.ts` و`.spec.ts`؛ وعقد `PackageSessionAvailability` في shared وAPI client. إعادة استخدام `creditId` كهوية الجلسة المشتراة في V2، لا إنشاء هوية حجز بديلة.

**Modify:** `book-from-credit/book-from-credit.handler.ts`, `get-matching-credits/get-matching-credits.handler.ts`, `package-credit-consume.helper.ts`, `package-credit-return.helper.ts`, ومعالجات check-in/complete/no-show/restore-no-show/cancel/client-cancel/approve-cancel/expire/reschedule، و`transfer-credit/transfer-credit.handler.ts`. جميعها تحت `apps/backend/src/modules/bookings/`. راجع `delete-booking.handler.ts` لحفظ دليل الحركة، و`refund-package-purchase.handler.ts` لعدم ترك موعد حي برصيد مبطل.

**Contract:** `assertPackageSessionBookable(tx, creditId, target)` يعيد التحقق بعد قفل الشراء ثم المجموعة/الرصيد/الموعد بترتيب موحد مع الأقفال الحالية. قائمة الإتاحة تستعمل نفس القرار، لكنها لا تغني عن المعاملة. `COMPLETED` الموثق وحده يحقق الإنجاز؛ CHECK_IN لا يفتح التالية. RETURNED يعيد إتاحة نفس creditId ولا يغير ترتيبه.

- [ ] اكتب اختبارًا: جلسة1 RESERVED، محاولة جلسة2 تنتج `PREDECESSOR_INCOMPLETE` ولا Booking جديد؛ بعد CHECK_IN تظل مرفوضة؛ بعد COMPLETE تنجح.
- [ ] اختبر NO_SHOW لجلسة1 ثم إعادة حجزها: نفس creditId، حركة RETURNED قديمة وحركة RESERVED جديدة، جلسة2 ما تزال مقفلة. تكرار العودة لا ينشئ حقًا إضافيًا.
- [ ] اختبر طلبين متزامنين من اتصالين PostgreSQL منفصلين للجلسة نفسها: نجاح واحد، تعارض واحد، reserved=1. كرر السباق مع refund/restore/transfer/check-in؛ لا تعتمد mocks لقفل الصفوف.
- [ ] اختبر الإكمال الآلي للجلسة المنتهية المسجل حضورها فقط، ومنع إكمال جلسة V2 مبطلة بالاسترداد. يظل القديم على سياسة واضحة ولا يكتسب ترتيبًا بأثر رجعي.
- [ ] أصلح التبديل للجلسات غير المحجوزة: offering مطابق، السعر ثابت، تحديث التعيين والمطابقة ذريًا، حدث from/to/reason/actor؛ اختبار بديل أغلى لا يغير amountPaid ولا unitPriceSnapshot ولا netValue.
- [ ] للموعد المحجوز: تعتمد النسخة الأولى رفض النقل العام برسالة تشرح وجود موعد وتوجيهه لمسار تعديل موعد صريح. إذا اعتمد المستخدم التبديل المباشر للموعد، أضف `reassign-package-booking-practitioner.handler.ts` وDTO واختبارات التوفر والتعارض وZoom/outbox قبل تفعيله؛ لا تمدد transfer بصمت.
- [ ] شغل اختبارات المعالجات المتأثرة وreal-e2e جديدة: `test/e2e/packages/package-group-sequence.real-e2e-spec.ts` و`package-group-reassignment.real-e2e-spec.ts`، مع الإبقاء على حزم الحجز/الاسترداد الموجودة.

ثابت العدّادات: `0 <= used + reserved <= total`. تطابق الحركات النشطة مع العدادات في الشراء النشط؛ RETURNED تاريخ محاولات يمكن أن يزيد مع إعادة الحجز، لذلك لا نستخدم `used + reserved + returned = total`. الشراء المسترد بالكامل له دلالة إبطال مستقلة؛ لا نعد used=total المصطنعة فيه إنجازًا علاجيًا.

## 4 — المحرر وواجهات الموظف

**Modify:**

- `apps/dashboard/components/features/packages/package-form-page.tsx`, `package-form-fields.tsx`, `package-form-helpers.ts`, `package-details-fields.tsx`, `package-item-fields.tsx`, `package-item-scopes.tsx`.
- `apps/dashboard/hooks/use-package-editor-state.ts`, `use-package-editor-item.ts`؛ `lib/schemas/package.schema.ts`, `lib/package-editor-step-validation.ts`, `lib/package-price.ts`, `lib/types/package.ts`.
- `apps/dashboard/components/features/bookings/wizard-steps/package-credit-picker.tsx`, `step-package.tsx`، و`components/features/clients/client-package-balances-panel.tsx` و`sell-package-form.tsx`.
- `apps/dashboard/lib/api/{packages.ts,credit-bookings.ts,package-credit-ops.ts}`، `hooks/use-package-credit-ops.ts`، وملفات ترجمة الباقات الفعلية التي يحددها البحث وقت التنفيذ.

**Create:** مكونات مركزة `package-group-fields.tsx`, `package-session-fields.tsx`, `package-group-dependency-fields.tsx` تحت مجلد features/packages.

**UI contract:** أربع خطوات: معلومات عامة ← المجموعات والجلسات ← إجمالي السعر والخصم ← مراجعة وحفظ. إزالة سؤال «جلسة محددة/اختيار عند الحجز» من V2؛ توضيح البديل كـ«جلسات متطابقة/تفصيل كل جلسة». خيارات LEGACY تبقى ظاهرة عند عرض نسخة قديمة ولا يعاد حفظها كـV2 خفية.

- [ ] اختبار component: إضافة مجموعة عيادة DIRECT يعرض اسم العيادة دون قائمة خدمة ثانية، واختيار ممارس لا يغير ممارس المجموعة الأخرى.
- [ ] اختبار تبديل متطابقة3 إلى مفصلة: تنشأ ثلاثة صفوف بالعدد نفسه؛ تغيير الثانية إلى45دقيقة/أونلاين يغيرها وحدها؛ جمع السعر يطابق backend.
- [ ] اختبار reorder وحذف مجموعة مرتبطة: تحديث مواضع الجلسات لا يغير keys، وحذف المجموعة المرجعية يطلب إزالة الرابط صراحة ولا يترك مرجعًا خفيًا.
- [ ] اعرض الممارس والمدة والحضور ورقم الجلسة وصافي السعر وسبب القفل. اعرض action واحدًا واضحًا للحجز من الجلسة المختارة؛ الخطأ من الخادم لا ينتقل تلقائيًا إلى حجز مدفوع.
- [ ] اكتب Playwright `apps/dashboard/e2e/flows/packages/package-groups.spec.ts` من إنشاء مختلط وبيع ثم حجز/حضور/إكمال وعدم حضور، بالإضافة إلى قراءة باقة LEGACY بلا تعديل.
- [ ] اختبر RTL على390/768/1440، لوحة المفاتيح وتركيز الخطأ والرجوع بين الخطوات وحفظ مسودة النموذج. احفظ صورًا فعلية للمراجعة، وشغل اختبارات المحرر الحالية بعد تحديث توقعات السلوك المقصود فقط.

## 5 — التقارير والحساب التاريخي

**Modify:** `apps/backend/src/modules/ops/generate-report/package-sales-report.builder.ts`, `package-consumption-report.builder.ts`, `outstanding-credit-report.builder.ts` واختباراتها؛ `apps/dashboard/components/features/reports/pages/packages-report-page.tsx` وعقود تقرير الباقات إذا أضيفت gross/refund/net. أبقِ `refunded-packages-report.builder.ts` وledger اختبارات رجوع إلزامية.

- [ ] اختبار فاشل لبيع1000 واستردادجزئي100: gross=1000، refund=100، net=900؛ لا يسقط البيع كله. فرق بين تقرير البيع ضمن فترة دفع وتقرير أحداث الاسترداد ضمن فترة وقوعها؛ لا تطرح حدثًا مرتين من payment وledger.
- [ ] اختبار جلستين مختلفتي السعر مع خصم إجمالي: الرصيد المتبقي من netValue المثبتة للجلسة الباقية، وليس سعر الكتالوج. الاسترداد الجزئي يحافظ على العدد وعلى سقف صافي الشراء في التقرير.
- [ ] اختبار استهلاك لدىA ثم نقل المتبقي إلىB: التاريخ المنجز يظل منسوبًا إلىA عبر snapshot الموعد، لا عبر employeeId الحالي للرصيد.
- [ ] أبق LEGACY null-net path كما هو، مع تسمية مصدر التقدير عند backfill/المعاينة. لا تخصم refundAmount عند تخزين netValue ثم تخصمه مرة أخرى عند التقرير.
- [ ] شغل اختبارات builders و`test/e2e/packages/package-refund-ledger.real-e2e-spec.ts`، وأثبت بقاء LIVE/LEGACY_REQUEST/LEGACY_AGGREGATE والتواريخ المجهولة.

## 6 — تحويل القوالب القديمة دون تغيير المبيعات

**Create:** `apps/backend/scripts/data-integrity/audit-package-group-conversion.ts`, `audit-package-group-conversion.spec.ts`, `apps/backend/scripts/convert-package-templates-v2.ts` و`.spec.ts`.

**Contract:** audit يخرج aggregate وملف mapping محمي: sourcePackageId/sourceRevision/classification/reasons/before/after. التصنيفات `READY_DRAFT`, `NEEDS_OFFERING_SELECTION`, `INCONSISTENT`, `LEGACY_PURCHASE_UNCHANGED`. apply يقبل القائمة المحددة فقط، يطابق sourceRevision، وينشئ مسودة جديدة مع مصدرها؛ unique source+revision يمنع التكرار. ليس تحديثًا شاملًا للقوالب المنشورة.

- [ ] fixture «5مدفوعة+1مجانية» ينتج معاينة6حقوق بنفس صافي السعر وبلا نشر؛ fixtureANY/EXCLUDE يحتاج اختيارًا؛ fixtureقديممباع يبقى دون تعديل.
- [ ] شغل dry-run مرتين وتحقق من عدم وجود writes؛ apply على قاعدة اختبار فقط مرتين ينتج مسودة واحدة؛ تعديل الأصل بينهما يرفض stale revision.
- [ ] اختبر فقد offering/مرجع ممارس أو عدم تطابق scalar والقيود: لا تحذف الصف ولا تصححه تلقائيًا؛ يظهر سبب المراجعة.
- [ ] قارن جميع purchase/invoice/payment/refund/usage وعدادات الرصيد قبل/بعد conversion، يجب تطابقها. العدد16مجانية في حصر الاستيج لا يبرر إلغاء أي حق.
- [ ] احتفظ بملف المعاينة قبل أي إذن تطبيق. يحتاج الإنتاج حصرًا مستقلًا بتفويض؛ لا تستخدم counts الاستيج لتحديد المتأثرين في الإنتاج.

## 7 — التحقق المتكامل والإطلاق

المصفوفة التالية قبول إلزامي، وليست عددًا متوقعًا لاختبارات خضراء:

| الحالة | النتيجة التي يجب إثباتها | المستوى |
|---|---|---|
| مقاييس + عيادة، ممارس واحد أو متعدد | اختيار صحيح لكل مجموعة، لا توريث عام | unit + browser |
| مدد وحضور مختلفان لكل جلسة | الاختيارات المسجلة فقط، السعر المعتمد منفصل عن الكتالوج | unit + API |
| ثلاث جلسات متطابقة/مفصلة | نفس عدد الحقوق بعد تبديل نمط الإدخال | component + browser |
| خصم نسبة/مبلغ/صفر/100% وتقريب هللات | مجموع القيم = صافي البيع | unit properties + DB |
| حجز1 ثم محاولة2 قبل الإنجاز | رفض حتى بعد check-in؛ يفتح بعد complete | real DB + browser |
| مجموعتان مرتبطتان/غير مرتبطتين | الرابط يتحقق عند الخادم؛ لا دائرة أو رابط مفقود | unit + real DB |
| مجموعة غير مرتبة | يمكن اختيار أي جلسة غير مستخدمة/محجوزة | real DB |
| no-show/إلغاء/استعادة/إعادة حجز | حق واحد ثابت، نفس الجلسة، لا فتح التالية | real DB |
| طلبان متزامنان وآخر مقعد | نجاح واحد دون عداد زائد | اتصالا PostgreSQL |
| حضور مقابل no-show/refund/restore | انتقال متسق أو conflict، لا نجاح جزئي | real DB |
| سعر الكتالوج/القالب يتغير بعد البيع | الحقوق والأسعار المباعة لا تتغير | API + DB |
| init قديم ثم deploy ثم webhook مكرر | snapshot محفوظ وإصدار صحيح، إصدار أرصدة مرة واحدة | real DB + sandbox عند مساس تكامل الدفع |
| تبديل متبقٍ إلى ممارس أغلى | لا فرق مالي، التاريخ يبقى، المطابقة تعمل | API + browser |
| تبديل مع موعد محجوز | رفض واضح أو مسار صريح مع توفر وسجل؛ لا تعديل خفي | API + browser |
| شراء مسترد وله موعد ماضٍ غير مغلق | لا إبطال وترك موعد قابل للتقديم | real DB |
| استرداد جزئي/كامل | الأثر المالي صحيح؛ الجزئي لا ينقص العدد | real DB + reports |
| تقرير الاستهلاك بعد تبديل الممارس | ينسب الماضي للممارس الذي قدم الجلسة | unit + reports |
| LEGACY مدفوع/مجاني/مرن/null-net | الحقوق والقيود والقيم التاريخية محفوظة | migration + regression |
| hard-delete/مراجع قديمة مفقودة | لا فقد لدليل الإنجاز، أو استثناء ظاهر للمراجعة | DB |
| mobile employee وclient/public-me وcron | إجراءات دورة الحجز لا تتجاوز قواعد الجلسة | controller + integration |
| REST قديم وجديد | لا كسْر مستهلك قديم، Unknown version يرفض | contract |
| RTL وعرض صغير وتنقل/errors | نموذج وحجز قابلان للاستخدام | browser + screenshots |

- [ ] أضف ملفات real-e2e الجديدة إلى `test:e2e:critical` وقائمة `--required` في `apps/backend/package.json`؛ لا يكفي وجود ملف لا تشغله البوابة.
- [ ] أثبت مصدر قاعدة الاختبار وضبط `REAL_E2E_DATABASE_URL` دون طباعة السر؛ شغل `pnpm --filter=backend run test:e2e:critical`. يجب فشل الإعداد عند غياب الرابط، و0 skipped في الحزم الحرجة.
- [ ] شغل backend unit، ثم `pnpm openapi:sync` وراجع فرق snapshot والأنواع المولدة وحدّث `packages/api-client` يدويًا؛ المنسق يملك هذه الملفات المشتركة.
- [ ] شغل `pnpm typecheck` و`pnpm --dir apps/mobile typecheck` لأن الموبايل خارج root workspace، ثم `pnpm lint` و`pnpm build` و`pnpm test` بحسب سطح التغيير المتكامل. لا تعاد الاختبارات الناجحة بلا تغييرات أو سبب.
- [ ] شغل `pnpm --filter=dashboard run e2e -- e2e/flows/packages/package-groups.spec.ts` و`pnpm --filter=dashboard run e2e:smoke` على تشغيل محلي/استيج مضبوط لا إنتاج؛ أحفظ النتائج والصور الحقيقية.
- [ ] سجل الأعداد والقيم قبل/بعد ترحيل rehearsal وأداة تحويل المسودات، وأثبت عدم تغير مشتريات LEGACY.
- [ ] راجع الفروق الفعلية ثم طبق `verification-before-completion`. لا commit/push/deploy إلا ضمن تفويض المستخدم وسياسة `docs/operations/deployment-policy.md`.
- [ ] بعد نشر الاستيج عند تفويضه، اختبر الدورة المختلطة يدويًا واعرضها للمستخدم. أي حصر/تعديل لقاعدة الإنتاج ينتظر إذنه المستقل.

## حالة هذه الجلسة

أنجزت تحليل المصدر وحصر الاستيج للقراءة فقط وكتابة النطاق والخطة. لم تنفذ أي حزمة أعلاه، ولم تشغل اختبارات التنفيذ الجديد، ولم تُغيّر قاعدة بيانات أو تنشر أو تعمل commit. وثيقة الحصر المصاحبة تحفظ الأعداد وحدود دلالتها؛ اجتياز الاختبارات السابقة لا يغطي الميزات المقترحة هنا.
