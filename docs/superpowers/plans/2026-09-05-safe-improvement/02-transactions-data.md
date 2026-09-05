# Transaction and Historical Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and test-driven-development for behavior changes. Steps use checkbox (`- [ ]`) syntax. Apply operations against historical data require a reviewed manifest and explicit authorization.

**Goal:** إغلاق P1-04 وP1-05 وP2-04، وإتاحة جرد ومصالحة البيانات القديمة دون فقدها.

**Architecture:** معاملة الإلغاء تكتب outbox، وحارس الأشخاص يستخدم حالات منشورة وأقفالًا متناسقة، وintake يحتفظ باستجابة حالية واحدة وتاريخ محفوظ. repair أداة تشغيل مستقلة عن API الموظف.

**Tech Stack:** NestJS 11، Prisma 7/Postgres، Jest، outbox/BullMQ الحاليان.

**Spec:** [التصميم](/Users/tariq/code/sawaa/docs/superpowers/specs/2026-09-05-safe-improvement-design.md). [النشر والتراجع](/Users/tariq/code/sawaa/docs/superpowers/plans/2026-09-05-safe-improvement-plan.md).

## Global Constraints

تطبق Global Constraints في التصميم والخطة الرئيسية، وبالأخص:

- المهاجرات إضافية فقط؛ لا تعديل migration تاريخية، ولا حذف أو استبدال بيانات العملاء لإكمال مهاجرة.
- لا بيانات عملاء أو أسرار أو نسخ قواعد بيانات في Git أو مخرجات CI أو سجلات عامة.
- اختبارات البيانات تستخدم REAL_E2E_DATABASE_URL لقاعدة معزولة مثبتة الهوية؛ لا reset أو seed على الإنتاج.
- المصادقة والصلاحيات وCASL ودلالات التوكن لا تتغير ضمن إعادة التنظيم؛ أي تغيير فيها يحتاج نطاقًا واعتمادًا صريحين.

## T1 / PR05 — إلغاء البرنامج ذريًا

**الملفات:**

- Modify: `apps/backend/src/modules/bookings/cancel-program/cancel-program.handler.ts` و`.spec.ts`.
- Modify عند الحاجة: `apps/backend/src/modules/bookings/events/booking-cancelled.event.ts` — eventId الاختياري المتوافق مع BaseEvent.
- Reuse: outbox-publisher وOutboxEvent الحاليان؛ لا publisher ثانٍ.
- Create: `apps/backend/test/e2e/bookings/program-cancel-outbox.real-e2e-spec.ts`.

**العقد:** لكل BookingStatusLog ناتج عن انتقال فعلي إلى CANCELLED حدث واحد بنفس log.id. event payload يبقي `refundType: NONE` و`paymentId: null`، فلا تتحول العملية إلى استرداد مالي تلقائي. حجز terminal لا يعاد تغييره أو إشعاره.

- [ ] **T1.1 — اكتب اختبار rollback المتعدد.** أنشئ برنامجًا بموعدين قابلين للإلغاء وموعد terminal؛ أفشل إدراج outbox للموعد الثاني. بعد rollback:

```ts
expect(programAfter.status).toBe(programBefore.status);
expect(bookingsAfter.map((b) => b.status)).toEqual(bookingsBefore.map((b) => b.status));
expect(await prisma.outboxEvent.count({ where: { aggregateId: { in: bookingIds } } })).toBe(0);
```

الأسماء أعلاه قيم fixture قبل/بعد المعاملة؛ fixture يجب أن يعزل بيانات هذا الاختبار ولا يعتمد على أعداد جدول مشترك.

- [ ] **T1.2 — اثبت الأحمر.** `pnpm --filter=backend test -- src/modules/bookings/cancel-program/cancel-program.handler.spec.ts`. الاختبار يفشل لأن publish الحالي يحدث داخل transaction دون outbox.
- [ ] **T1.3 — نفذ الإدراج داخل المعاملة.** التقط log.id الناتج من create، أنشئ event envelope واحفظه بـtx.outboxEvent.create. أزل eventBus.publish داخل حلقة الإلغاء. أبقِ قفل Program الذي يمنع التسجيل المتزامن؛ اقرأ/حدّث حالات الحجوزات تحت أقفال/شروط انتقال تمنع كتابة CANCELLED فوق انتقال terminal متزامن.
- [ ] **T1.4 — اختبر السباقات.** إلغاء مقابل enrollment، إلغاء مقابل complete، إعادة الإلغاء، broker غير متاح ثم التعافي. إذا اكتمل الموعد قبل أخذ قفله يبقى مكتملًا؛ لا يعتمد القرار على snapshot حالة قديمة. راجع ترتيب Program ثم Booking مع مسارات التسجيل والإكمال الحالية لمنع deadlock.
- [ ] **T1.5 — شغل DB.** `pnpm --filter=backend run test:e2e:real -- test/e2e/bookings/program-cancel-outbox.real-e2e-spec.ts`. المتوقع: النجاح يترك event لكل تغيير فعلي فقط؛ الفشل لا يترك event ولا status change. تسليم النقل الحقيقي يغطى ببوابة O1؛ helper real-DB الحالي يmock BullMQ.

**التراجع:** نفس event schema المستهلك مسبقًا؛ تحفظ أحداث PENDING حتى تسلم. لا manual refund أو رسالة تصحيح عميل آلية لمجرد تغيير النسخة.

## T2 / PR06 — الحذف لا يقطع علاقة نشطة

**الملفات:**

- Reuse: `apps/backend/src/modules/bookings/active-booking-statuses.ts` — ACTIVE_BOOKING_STATUSES للحياة التشغيلية، لا STAFF_TIME_BLOCKING_BOOKING_STATUSES التي تضم completed/no-show لأسباب حجز الوقت.
- Modify: `apps/backend/src/modules/people/employees/delete-employee.handler.ts` و`clients/delete-client.handler.ts` والمواصفات المجاورة.
- Create: `apps/backend/src/common/database/person-reference-lock.helper.ts` و`.spec.ts` — عقد أقفال محايد لا يستورد modules.
- Modify لتبني القفل والتحقق في كُتّاب العلاقات: `apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts` و`book-from-credit/book-from-credit.handler.ts` و`enroll-in-program/enroll-in-program.handler.ts` و`restore-no-show-booking/restore-no-show-booking.handler.ts` إذا كان يعيد إحياء علاقة نشطة.
- Inspect: `apps/backend/src/modules/ops/legacy-import/legacy-import.writer.ts`؛ importer writer قديم لا يبقى قابلًا للتشغيل بالتوازي دون القفل أو حاجز تشغيلي معلن.
- Create: `apps/backend/test/e2e/bookings/person-delete-race.real-e2e-spec.ts`.

**العقد:**

```ts
export function lockPersonReferences(
  tx: Prisma.TransactionClient,
  refs: ReadonlyArray<{ kind: 'Client' | 'Employee'; id: string }>,
  mode: 'reference' | 'delete',
): Promise<void>;
```

`reference` يأخذ FOR SHARE لصف الشخص ويعيد التحقق من الوجود/isActive داخل المعاملة؛ FOR KEY SHARE وحده لا يحمي soft-delete العميل الذي يغير عمودًا غير مفتاحي. `delete` يأخذ FOR UPDATE قبل فحص العلاقات. SQL parameterized، وأسماء الجدول من whitelist ثابتة، لا input مستخدم. ترتيب الأنواع ثم IDs حتمي. تُنشر قواعد ترتيب الأقفال في tests وتطبق على create/credit/program/delete؛ لا معاملات متداخلة مستقلة تفقد القفل.

- [ ] **T2.1 — أثبت الفجوة الدقيقة.** DEPOSIT_PAID وInvoice PAID، دون موانع التقييم/الإشراف الأخرى: حذف العميل والموظف يرفض ويبقي السجلات. أضف PENDING_GROUP_FILL وكل حالة في ACTIVE_BOOKING_STATUSES. لا تدّع أن PARTIALLY_PAID الاعتيادية كانت تسمح بالحذف؛ حارس الفاتورة كان يمنعها.
- [ ] **T2.2 — شغل الأحمر ثم وحد قوائم الحالات.**

```bash
pnpm --filter=backend test -- src/modules/people/employees/delete-employee.handler.spec.ts src/modules/people/clients/delete-client.handler.spec.ts
```

استخدم المصدر المنشور بدل نسخ literals. أبقِ حراس الفواتير والتقييمات والإشراف الموجودة. رسالة تعارض أعمال واضحة، مع تثبيت status code المعتمد في العقد؛ إذا انتقل إلى409 عن الكود الحالي يوثق ويغطى العميل، ولا يتغير خلسة.

- [ ] **T2.3 — نفذ قفل الحذف والتحقق الذري.** الشخص مقفول، ثم فحص كل العلاقات النشطة، ثم الحذف/soft-delete الحالي داخل نفس tx. لا تحويل كل عمليات الحذف إلى hard-delete، ولا إضافة FKs ضخمة تلقائيًا عبر جميع النطاقات.
- [ ] **T2.4 — أغلق جانب الكاتب.** المرجع الجديد أو المعاد إحياؤه يأخذ القفل نفسه ويتحقق من active قبل الكتابة. أنشئ جدول كل `booking.create/createMany` وenrollment وإعادة التنشيط من rg/AST، وراجع كل إنتاجي؛ التعليق أو eventName المطابق للنص ليس writer. بالنسبة للبرنامج/الرصيد، خذ الأقفال بترتيب متسق مع الموجودة وأضف اختبارًا يلتقط الانتظار المتبادل.
- [ ] **T2.5 — تحقق متزامن على DB.** `pnpm --filter=backend run test:e2e:real -- test/e2e/bookings/person-delete-race.real-e2e-spec.ts`. اختبر اتصالين: إذا سبق الحجز يُرفض الحذف؛ إذا سبق الحذف يُرفض إنشاء/إحياء الحجز؛ لا صف نشط بشخص مفقود. اختبر حذفًا مشروعًا بلا علاقات لمنع حجب الوظيفة كلها.

**قبول T2:** المصدر الموحد + الفحص الذري + تغطية الكاتب. تصحيح قائمة الحالات وحده لا يثبت منع سباق إنشاء جديد. البحث عن موظفين مفقودين سابقًا في R1؛ لا إعادة إنشاء هويات تخمينية.

## T3 / PR07 — intake: كاتب متسلسل وقراءة متوافقة وتاريخ محفوظ

**الملفات:**

- Modify: `apps/backend/prisma/schema/organization.prisma`.
- Create migration إضافية: `apps/backend/prisma/migrations/20260905000100_intake_response_history/migration.sql`؛ اسم مقترح يحجز في B0 ويُعدّل قبل الإنشاء فقط إذا سبقته مهاجرات أحدث. لا يعدل بعد التطبيق.
- Modify: `apps/backend/src/modules/org-experience/submit-intake-response/submit-intake-response.handler.ts` و`.spec.ts`.
- Modify: `apps/backend/src/modules/org-experience/intake-forms/get-intake-form-responses.handler.ts` و`.spec.ts`.
- Modify: `apps/backend/src/modules/bookings/delete-booking/delete-booking.handler.ts` — حفظ snapshot عند الحذف المصرح أصلًا؛ لا توسيع permission أو شروط الحذف المالي.
- Inspect/align: `apps/backend/src/modules/ops/legacy-import/legacy-import.writer.ts` و`legacy-import.audit.ts`؛ تعطيل تشغيل writer القديم تشغيليًا إلى أن يدعم العقد.
- Create: `apps/backend/test/e2e/bookings/intake-current-response.real-e2e-spec.ts`.

**عقد البيانات الإضافي:**

```prisma
// Added to IntakeResponse; existing ids and answers stay intact.
supersededAt   DateTime?
supersededById String?

// New immutable snapshots. No cascading relation to a live row being deleted.
model IntakeResponseRevision {
  id               String   @id @default(uuid())
  sourceResponseId String
  bookingId        String
  formId           String
  clientId         String?
  answers          Json
  capturedAt       DateTime @default(now())
  reason           String   // UPDATE or AUTHORIZED_DELETE

  @@index([sourceResponseId, capturedAt])
  @@index([bookingId, formId])
}
```

التاريخ append-only في التطبيق ولا endpoint عام جديد لقراءته؛ وصوله يظل ضمن حدود بيانات الاستقبال الحالية. عدم FK cascading مقصود للاحتفاظ بالأصل بعد إجراء حذف مصرح، مع source identifiers واضحة. تسوية duplicate القديمة تبقي الصف نفسه superseded ولا تحتاج نقله/حذفه.

- [ ] **T3.1 — اختبر التزامن والتاريخ.** اتصالان يقدمان booking/form نفسه: صف current واحد. عند إجابتين مختلفتين يُحفظ snapshot للقيمة السابقة ويحدث الصف current مع بقاء id، بدل lost update بلا أثر. إرسال answers نفسها مرتين no-op ولا revision غير لازمة.
- [ ] **T3.2 — طبق توسعة schema فقط.** الأعمدة nullable والجدول الجديد فارغ؛ لا UNIQUE بعد ولا UPDATE شامل. old binary يظل قادرًا على القراءة والكتابة في هذه الخطوة. اختبر migrate على قاعدة جديدة وعلى snapshot صناعية تحتوي مكررًا.
- [ ] **T3.3 — نفذ الكاتب داخل tx.** استخدم advisory transaction lock ثابتًا لـ`intake:{bookingId}:{formId}` بواسطة `pg_advisory_xact_lock(hashtextextended(key,0))` مع binding، أو قفل صف Booking المقابل إن اعتمد الاختبار كلفته. العقد المعتمد لهذا المسار هو advisory key؛ لا خلط writer بقفل مختلف. بعد القفل أعد فحص ملكية الحجز وصلاحية النموذج، اقرأ current، ثم snapshot-before-update أو create. ownership 404 الحالية لا تتغير.
- [ ] **T3.4 — عالج المكرر القديم دون اختيار طبي آلي.** إذا وجد الكاتب أكثر من current row، لا يحذف ولا يدمج؛ يعيد conflict واضح لهذا booking/form إلى أن يُعتمد canonical في T4. لا يمنع باقي العملاء من إرسال نماذج سليمة.
- [ ] **T3.5 — حدّث القراء والعدادات.** `findMany` و`groupBy` التشغيليان يستعملان supersededAt=null؛ قارئ legacy audit يستمر في رؤية كل النسخ مع تمييزها. لا تستخدم spread لحقول التاريخ الداخلية في HTTP؛ response القديم فقط، وأي metadata جديدة تحتاج DTO وصلاحية معلنة.
- [ ] **T3.6 — احمِ التاريخ من الحذف الحالي.** قبل deleteMany للاستجابات في عملية delete-booking المسموحة، اكتب snapshot لكل current/superseded row داخل المعاملة ثم طبق السلوك المصرح الحالي. إذا فشل الأرشيف تفشل العملية كلها. اختبر أن revision لا تمسح بـcascade وأن شروط منع حذف المال لم تتغير. لا تنفذ حذفًا فعليًا كجزء من هذه الخطة.
- [ ] **T3.7 — تحقق القراءة/الكتابة القديمة والجديدة.**

```bash
pnpm --filter=backend test -- src/modules/org-experience/submit-intake-response/submit-intake-response.handler.spec.ts
pnpm --filter=backend run test:e2e:real -- test/e2e/bookings/intake-current-response.real-e2e-spec.ts
```

**بوابة طرح:** تطبيق schema ثم النسخة المتوافقة. وجود الأعمدة لا يثبت انتقال كل الكتاب. يسجل release log خلو النسخ والعمال/importer القديم من الكتابة قبل T4. لا تسوية بيانات قديمة في PR07.

## T4 / PR08 — canonicalization ثم قيد قاعدة البيانات

**الملفات:**

- Create: `apps/backend/scripts/data-integrity/intake-manifest.ts` و`intake-apply.ts` و`intake-integrity.spec.ts`.
- Create migration إضافية مستقلة: `apps/backend/prisma/migrations/20260905000200_intake_current_unique/migration.sql` وفق حجز الاسم في B0.
- Modify: submit-intake-response handler للتعامل المحدود مع P2002 عند وجود كاتب متوافق آخر؛ الاختبارات المجاورة.

**القيد المقترح:**

```sql
CREATE UNIQUE INDEX "IntakeResponse_one_current_per_booking_form"
ON "IntakeResponse" ("bookingId", "formId")
WHERE "supersededAt" IS NULL;
```

هذا partial unique لا `@@unique([bookingId,formId])` الذي سيمنع حفظ الصفوف السابقة. Prisma upsert لا يستهدف القيد الجزئي؛ يبقى writer المقفول، وP2002 يعيد transaction كاملة بحد أقصى3 محاولات وبـbackoff قصير، ثم409 قابل للمراجعة.

- [ ] **T4.1 — أنشئ dry-run manifest.** group by booking/form للcurrent المكرر؛ احسب hash canonical للـanswers بدون طباعتها. المتطابق تمامًا يرشح أقل `(createdAt,id)`، والمختلف يحمل `requiresReview=true` بلا اختيار تلقائي. لا توقيت أحدث=إجابة أصح.
- [ ] **T4.2 — راجع manifest.** كل group يحتوي source IDs وhashes والمرشح وقرار canonical ومعرف المراجع. المستخدم/صاحب البيانات يراجع التفاصيل عبر مخزن محمي. عدم القرار يبقي المجموعة unresolved ولا تُطبق migration حتى تزول كل current duplicates.
- [ ] **T4.3 — طبق batch صغيرًا مأذونًا.** نفس advisory lock، verify hashes/current state، ثم mark بقية الصفوف supersededAt وsupersededById. عدد الصفوف والإجابات الخام قبل وبعد ثابتان؛ لا delete أو rewrite answers. تعارض hash يعني skip/report، لا force.
- [ ] **T4.4 — تحقق الجرد قبل الفهرس.** query `GROUP BY bookingId,formId HAVING count(*)>1` مع supersededAt IS NULL يرجع صفرًا. اختبر استمرار الكتابة من النسخة المتوافقة وتأكد من عدم وجود كاتب قديم.
- [ ] **T4.5 — طبق القيد بعد rehearsal.** قِس قفل إنشاء الفهرس على حجم مشابه. إذا لم يناسب نافذة التشغيل، يُستخدم CREATE UNIQUE INDEX CONCURRENTLY في migration خارج transaction مع runbook لحالة invalid index وفشل Prisma migration؛ لا يغير القرار migration مطبقة. فشل البناء يوقف الانتقال ولا يؤدي إلى حذف مكرر. إصلاح invalid index إجراء schema محدد ومراجع، لا drop عشوائي.
- [ ] **T4.6 — اثبت القيد والتاريخ.** raw concurrent INSERT مباشر يتجاوز التطبيق يجب أن يخسر أحد الطلبين بـunique violation؛ writer الاعتيادي يتعامل معها دون500. current واحد، كل answers الأصلية ما زالت قابلة للاسترجاع عبر التاريخ المحمي.

**Rollback T4:** يمكن الرجوع إلى كاتب PR07 المتوافق، مع إبقاء superseded rows والفهرس. لا الرجوع إلى قارئ يتجاهل supersededAt بعد canonicalization. عكس قرارات canonical يحتاج manifest عكسي وشرط عدم حدوث إجابة لاحقة؛ لا مسح supersededAt جماعيًا.

## R1 / PR16 — جرد وتصحيح محدد للحالات التاريخية

**الملفات:**

- Create: `apps/backend/scripts/data-integrity/audit-finance-bookings.ts` و`apply-booking-repairs.ts` و`repair-manifest.ts` و`repair-manifest.spec.ts`.
- Create: `docs/operations/data-integrity-reconciliation.md` — تعليمات بلا بيانات أشخاص.
- Reuse: calculateInvoiceBalance من F1، وقواعد انتقال الحجز الحالية، وActivityLog داخل tx.

**عقد manifest:**

```ts
export interface BookingRepairItem {
  bookingId: string;
  expectedStatus: string;
  targetStatus: string;
  evidencePaymentIds: string[];
  evidenceInvoiceId: string;
  expectedFingerprint: string;
  decision: 'APPROVED' | 'REVIEW_REQUIRED' | 'NO_CHANGE';
  reasonCode: 'MISSED_PAYMENT_TRANSITION';
}
export interface BookingRepairManifest {
  schemaVersion: 1;
  batchId: string;
  sourceSnapshot: string;
  ruleVersion: string;
  approvedBy: string | null;
  items: BookingRepairItem[];
}
```

العقد محدود لإصلاح أثر الحجز المفقود، وليس تصريح تعديل أي targetStatus. التطبيق يقبل فقط أزواج الانتقال المسموحة في state machine ومثبتة بالدفع؛ لا يقبل arbitrary status من JSON. manifest metadata لا يعوض تفويض المشغل والوصول إلى البيئة.

- [ ] **R1.1 — اجمع candidates read-only.** فواتير overCollected، فرق Payment.refundedAmount مع مجموع refunds المكتملة، PAID/deposit mismatch، أشخاص مفقودون، duplicates intake، outbox عالق. استخدام cursor pagination وbatch100، لا تحميل القاعدة كلها ولا اتصالات مزود تغير حالة.
- [ ] **R1.2 — صنف كل فئة.** overcollection أو missing person أو provider unknown = مراجعة بشرية فقط؛ لا refund أو recreation. missed-payment-transition لا يرشح تلقائيًا إذا أُلغي الموعد أو انتهى أو تغير بعد الدفع. انتهاء الموعد زمنيًا ليس إذنًا لإحيائه أو إشعار العميل.
- [ ] **R1.3 — اثبت dry-run لا يكتب.** Prisma query logging داخل الاختبار يرفض INSERT/UPDATE/DELETE؛ count/checksum ثابتان. logs تعرض الأعداد وreason codes لا answers أو أسماء أو بيانات دفع.
- [ ] **R1.4 — نفذ apply الآمن.** يطلب manifest معتمدًا، يرفض REVIEW_REQUIRED، يقفل الحجز/الفاتورة بترتيب متفق، يعيد حساب fingerprint والدليل، يطبق الانتقال المسموح وstatus log وActivityLog في tx واحدة. استعمل batchId/itemId للتتبع ومنع إعادة الأثر؛ الحالة أصبحت target مع نفس دليل التصحيح=alreadyApplied، وأي اختلاف لاحق=conflict، وليس overwrite.
- [ ] **R1.5 — لا تعِد بث PaymentCompleted القديم.** استدعاء قاعدة تحديث الحجز دون الآثار الخارجية أو أمر repair مخصص يستعملها. الإشعارات والإيصالات/الاستردادات لا تُرسل افتراضيًا. إن احتاجت حالة بعينها رسالة، فتراجع وتفوض كتواصل مستقل.
- [ ] **R1.6 — اختبر partial failure/retry.** batch صغير، فشل منتصفه، ثم إعادة التشغيل: لا تغيير مكرر ولا rollback لتعديلات عملاء حدثت بعده. يحتفظ receipt لكل item بنتيجة applied/alreadyApplied/conflict وhash قبل وبعد في مخزن محمي.
- [ ] **R1.7 — شغل على عينة معتمدة أولًا ثم راجع.** no global update، لا إصلاح أكثر مما تحتويه IDs المعتمدة. تحقق counts وmoney totals وsnapshot invariants بعد كل batch؛ يتوقف عند أي اختلاف غير متوقع.

**القبول:** لا ادعاء بأن العملاء تضرروا من مجرد وجود عيب كود. ينتج الجرد عددًا مثبتًا للحالات، والتصحيح محصور ومعاد التشغيل بأمان، وكل unresolved واضحة. التراجع يكون بتصحيح تعويضي مراجع إذا لم توجد عمليات لاحقة متعارضة؛ لا restore لقاعدة قديمة فوق البيانات الحية.
