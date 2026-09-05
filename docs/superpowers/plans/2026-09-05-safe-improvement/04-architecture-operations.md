# Architecture and Operations Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and verification-before-completion. Steps use checkbox (`- [ ]`) syntax. Orchestrator owns broad verification and release integration; workers do not run competing builds/full suites.

**Goal:** إغلاق فجوات بوابات الاختبار وحدود الوحدات والتقارير الثقيلة: P2-05 وP2-07 وP2-08.

**Architecture:** modular monolith محفوظ، بعقود قراءة صغيرة واتجاه imports واضح. اختبار DB والنقل وإعدادات HTTP طبقات منفصلة. قياس الأداء يسبق توسيع البنية التحتية.

**Tech Stack:** NestJS/Prisma/Postgres، Redis/BullMQ، Next.js، Jest/Vitest/Playwright، GitHub Actions، telemetry الحالية.

**Spec:** [التصميم](/Users/tariq/code/sawaa/docs/superpowers/specs/2026-09-05-safe-improvement-design.md). [خطة النشر والمراقبة](/Users/tariq/code/sawaa/docs/superpowers/plans/2026-09-05-safe-improvement-plan.md).

## Global Constraints

تطبق Global Constraints في التصميم والخطة الرئيسية، وبالأخص:

- تبقى Next.js 15 وReact 19 وNestJS 11 وPrisma 7؛ لا ترقية framework أو إعادة تسمية packages ضمن هذه الخطة.
- المشروع single-tenant لمركز واحد؛ لا organization switching ولا subscription billing.
- المصادقة والصلاحيات وCASL ودلالات التوكن لا تتغير ضمن إعادة التنظيم؛ أي تغيير فيها يحتاج نطاقًا واعتمادًا صريحين.
- build وdashboard typecheck يعملان بالتتابع، وليس بالتوازي، لمنع سباق .next/types.
- لا بيانات عملاء أو أسرار أو نسخ قواعد بيانات في Git أو مخرجات CI أو سجلات عامة.

## O1 / PR01 — بوابة تمنع مرور نفس فئات العيوب

**الملفات:**

- Modify: `.github/workflows/ci.yml` و`.github/workflows/nightly-e2e.yml` فقط لربط المسارات والاحتفاظ بالتغطية الليلية.
- Modify: `apps/backend/src/main.ts` و`apps/backend/test/helpers/create-real-e2e-app.ts` وhelper standard المتأثر بعد قراءته؛ لا استبدال البيئة الإنتاجية ببيئة permissive.
- Create: `apps/backend/src/common/bootstrap/configure-http-contract.ts` و`.spec.ts` — إعداد prefix/versioning/ValidationPipe فقط.
- Create: `apps/backend/test/e2e/contracts/production-validation.real-e2e-spec.ts`.
- Create: `apps/backend/test/jest-outbox-integration.json` و`apps/backend/test/setup-outbox-integration.ts` و`apps/backend/test/integration/outbox-transport.integration-spec.ts` — إعداد منفصل لا يحمل mocks BullMQ/Redis في setup-e2e الحالي.
- Create: `scripts/assert-critical-test-results.mjs` و`.test.mjs`؛ Modify `apps/backend/package.json` لإضافة scripts البوابة.

**العقد:**

```ts
export function configureHttpContract(
  app: INestApplication,
  profile: 'production' | 'development',
): void;
```

نفس السلوك الحالي في main: prefix=`api` وURI versioning defaultVersion=`1` وwhitelist/forbidNonWhitelisted/transform=true، وenableImplicitConversion=false للإنتاج. helper الحقيقي يستخدم profile production لا `process.env.NODE_ENV=test` كدلالة للتحقق. لا نسخ constants للتوكن أو guards ولا تغيير CORS/secret validation تحت اسم test parity.

- [ ] **O1.1 — أثبت اختلاف الإعداد.** اختبار يرسل unknown field وnumeric string/number وboolean false/string false إلى DTO حقيقية مستخدمة في التحصيل/الحجوزات. المتوقع نفس accept/reject للـproduction profile وbootstrap الإنتاج، ولا تحول string "false" إلى true. لا تجعل كل query numeric strings مرفوضة دون قراءة @Type/@Transform الفعلية.
- [ ] **O1.2 — استخرج الإعداد بلا تغيير semantics.** main يستدعي configureHttpContract بنفس env selection الحالية؛ real-DB helper يختار production صراحة. اختبار prefix/versioning يؤكد `/api/v1` دون `/api/v1/v1` أو route تغيير. interceptors/guards/المزودون يبقون في مكانهم.
- [ ] **O1.3 — lane حرجة لكل PR مالي/حجوزات.** Postgres معزول، migrations كاملة، REAL_E2E_DATABASE_URL موجود، cleanup محصور بfixture IDs. المسارات المطلوبة بعد إضافتها: invoice-balance-concurrency، manual-payment-outbox، program-cancel-outbox، person-delete-race، intake-current-response، production-validation، والاختبارات الحالية لمويسَر والرصيد/auth التي تتأثر. إعداد lane موجود أولًا ثم تضاف الملفات عند هبوط PRها؛ لا assertion لملف لم ينشأ بعد على أنه passed.
- [ ] **O1.4 — امنع نجاحًا بسبب skip.** parser لنتيجة Jest JSON يثبت exit0 وnumFailedTests=0 وnumPendingTests=0 للمجموعة الحرجة، وأن كل path مطلوبة ظهرت وأن عدد tests فيها>0. env غائب أو DB غير آمنة يوقفان lane. full nightly يبقى أوسع؛ لا إزالة139 اختبارًا كي يصغر وقت CI.
- [ ] **O1.5 — افصل اختبار النقل الفعلي.** create-real-e2e-app الحالي يتصل بـPostgres لكن setup-e2e يmock BullMQ/Redis. لذلك شغل تكاملًا مستقلًا بـRedis اختبار حقيقي وqueue names ذات test-run prefix، وoutbox publisher/consumer فعليين. external SMS/Email/Zoom/Moyasar adapters وحدها fakes أو sandbox؛ لا يتسرب outbound إلى بيانات عملاء.
- [ ] **O1.6 — حقن أعطال النقل.** أوقف Redis الخاص بالاختبار بعد commit، تحقق من PENDING فيPostgres، أعده وتحقق من الاستهلاك. اقتل worker الخاص بالاختبار بعد التسليم وقبل acknowledgment، أعده وتحقق من عدم تكرار أثر الحجز/الرصيد. لا flush Redis مشترك، ولا توقف أي process إنتاجي. سجل receipt eventId/consumerId دون PII.
- [ ] **O1.7 — smoke built app بإعدادات الإنتاج.** build backend ثم شغله بـproduction profile مع test-only secrets صحيحة الشكل وبنية اختبار منفصلة، ثم dashboard smoke المصادق عليها. تشغيل health وحده لا يكفي. حافظ على إعداد الأمن الحقيقي؛ لا تعطيل guard لتسهيل fixture.
- [ ] **O1.8 — تحقق البوابة نفسها.** tests لـassert-critical-test-results: missing file،all skipped،test failed،JSON invalid،كلها exit غير0؛report مكتمل فقط يمر. احفظ artifacts منقحة للـSHA/الأوامر/counts ولقطات fixtures.

**قبول O1:** لكل ادعاء دليل من طبقته: unit للقاعدة، Postgres للذرية، Redis/BullMQ للتسليم، HTTP production للـDTO، ومتصفح مصادق عليه للرحلة. لا تجمع هذه التسميات تحت «E2E نجح» إذا لم تعمل طبقة منها.

## O2 / PR13 — حدود الباك إند دون إعادة تصميم

**الملفات:**

- Create: `apps/backend/src/modules/people/public-read/people-public-read.module.ts` و`index.ts`.
- Modify: `apps/backend/src/modules/people/people.module.ts` و`apps/backend/src/modules/comms/comms.module.ts` و`apps/backend/src/modules/comms/chat/assistant/administrative-tools.service.ts`.
- Reuse: `apps/backend/src/modules/people/employees/public/list-public-employees.handler.ts`؛ provider واحد ومنطق public filtering نفسه.
- Create: `apps/backend/src/common/contracts/ai-provider-config.types.ts` بنقل العقود/parsing الحالية دون تغييرها.
- Modify: `apps/backend/src/modules/ai/provider-config/ai-provider-config.types.ts` ليعيد export مؤقتًا، و`apps/backend/src/infrastructure/ai/ai-provider-client.service.ts` و`chat.adapter.ts` ليستوردا العقد المحايد.
- Create: `scripts/check-backend-boundaries.mjs` و`.test.mjs` وbaseline مصغر إذا لزم، مع CI integration.
- Test: people/comms/identity module specs الحالية وAI provider specs؛ اختبار graph بدون SCC الجديدة.

**عقد فك الدورة:** Comms تحتاج ListPublicEmployeesHandler من People بسبب administrative tools؛ handler يعتمد Database فقط. PeoplePublicReadModule تستورد DatabaseModule وتصدر handler. PeopleModule تستورد هذا module وتزيل تسجيل handler المكرر من providers/exports المباشرة، وComms تستورد public-read بدل PeopleModule. administrative-tools تستورد handler عبر public-read/index. لا تعديل IdentityModule أو permission semantics مطلوب لهذا القطع.

شكل module المقترح:

```ts
@Module({
  imports: [DatabaseModule],
  providers: [ListPublicEmployeesHandler],
  exports: [ListPublicEmployeesHandler],
})
export class PeoplePublicReadModule {}
```

- [ ] **O2.1 — اختبار graph وتهيئة.** fixture dependency-cycle تكشف People→Identity→Comms→People الحالية؛ بعد القطع لا تعود هذه SCC. Nest boot يثبت بقاء حقن ListPublicEmployeesHandler في callers نفسها وعدم إنشاء provider نسختين.
- [ ] **O2.2 — نفذ public read boundary.** انقل ownership للـprovider فقط؛ endpoints والفلترة isPublic/isActive وشكل JSON وأسعار العرض تبقى نفسها. لا تفتح البحث الخاص للـAI أو توسع tool data.
- [ ] **O2.3 — افصل AI contract.** انقل types/defaults/parser الحالية حرفيًا، ثم re-export من المسار القديم أثناء الانتقال. backend infrastructure لا يستورد modules/ai بعدها. اختبار parse/serialization مقابل fixtures القديمة؛ لا تبديل model أو provider أو مفاتيح أو encryption fingerprint.
- [ ] **O2.4 — ratchet imports فعلي.** حل aliases/relative imports/re-exports بطريقة AST/TypeScript resolution؛ fixture لاستيراد مخالف عبر barrel وأخرى type-only. common لا يعتمد modules؛ infrastructure لا يعتمد modules. الاستثناء موجود ومسمى لا wildcard على مجلد كامل. لا إدخال repository abstraction عام.
- [ ] **O2.5 — قسم مسؤولية ملف مُعدل فقط.** invoice-balance صار helper مالي، وanalytics/DTO صارا ملفات مستقلة. لا تقسيم refund-provider state machine965 سطرًا ضمن تغيير حساب الرصيد نفسه لمجرد العدد. أي فصل إضافي يملك tests/export compatibility ومهمة منفصلة يمكن رفضها دون تعطيل الإصلاح المالي.
- [ ] **O2.6 — قبول إعادة التنظيم.** API snapshots والسلوك ومصفوفة permission ثابتة، SCC المستهدفة زالت، واستيرادات AI المعكوسة زالت، ولا زيادة في exception baseline.

**التراجع:** code-only backward-compatible re-exports، دون schema. لا ترقية dependencies ضمن PR الحدود.

## O3 / PR14 — حدود الداشبورد والتنظيم

**الملفات:**

- Move مع تحديث imports: `components/features/services/employee-service-toggles.tsx` و`employee-custom-pricing-row.tsx` و`components/features/employees/remove-service-dialog.tsx` إلى `apps/dashboard/components/features/shared/employee-service/`.
- Modify: `apps/dashboard/components/features/employees/edit-employee-service-sheet.tsx` و`apps/dashboard/components/features/services/assigned-employee-row.tsx` وجميع callers المحددة عبر rg.
- Move المشترك: `apps/dashboard/components/features/activity-log/activity-log-columns.tsx` إلى `apps/dashboard/components/features/shared/activity-log-columns.tsx` وتحديث users/activity-log-tab والنطاق الأصلي.
- Modify: `apps/dashboard/eslint.config.mjs`؛ Create `scripts/check-dashboard-feature-boundaries.mjs` و`.test.mjs` إن لم يغط ESLint installed resolver كل الأشكال.
- Create عند الحاجة: `apps/dashboard/architecture-baseline.json` للحالات القديمة المحددة بالملف/القاعدة، لا allowlist عامة.
- Test: `apps/dashboard/test/unit/services/edit-employee-service-sheet.spec.tsx` و`assigned-employee-row.spec.tsx` واختبارات activity log الحالية.

**العقد:** shared يستورد hooks/lib/ui ويصدر props نفسها؛ لا shared→features/{employees,services,users}. الشكل والسلوك والتفويض داخل الأزرار نفسها. توسيع @sawaa/ui إلى منطق نطاقي غير مسموح؛ هذه مكونات أعمال مشتركة للداشبورد فقط.

- [ ] **O3.1 — اختبر القاعدة قبل النقل.** fixtures تستورد feature أخرى بـalias وبـrelative وبـbarrel export؛ الثلاثة يجب كشفها. استيراد own feature وshared مسموح. جرد directories الفعلية يتضمن employees/clients بدل الاعتماد على practitioners/patients القديمة.
- [ ] **O3.2 — نفذ النقل دون تغيير props/markup.** استخدم exports موحدة للمشترك، وحدّث references كلها. لا تترك feature A تعيد export من feature B بحجة compatibility؛ يصنع دورة مخفية.
- [ ] **O3.3 — ثبت limits بالتدرج.** حد dashboard350 سطرًا يطبق على الملفات المضافة أو التي تغيرت مسؤوليتها؛ الملفات القديمة الكبيرة تسجل بbaseline ويمنع نموها دون فصل مبرر. translation dictionaries تفصل حسب namespaces مع public lookup t() نفسه ومراجعة Arabic/English parity، إذا كانت ضمن الملف المعدل. لا إعادة تقسيم الترجمات كاملة في هذه الدفعة.
- [ ] **O3.4 — اختبر UI وحدود الاستيراد.** اختبارات existing sheet/remove/toggle/activity filters تمر، screenshots fixtures ثابتة، وlint يرفض fixture المخالفة. مصدر truth قائمة features آلية أو assertion تطابق المجلدات لمنع تكرار فجوة employees/clients.

**قبول O3:** employees↔services وusers→activity-log لم تعود imports مباشرة؛ لا كسر طرق العرض أو أزرار الإجراءات؛ لا تعطيل rule للتخلص من warnings.

## O4 / PR15 — التقارير تحت الحمل والرصد

**الملفات الأساسية:**

- Modify: `apps/backend/src/modules/ops/generate-report/revenue-report.builder.ts` و`bookings-report.builder.ts` و`generate-report.handler.ts` و`excel-export.builder.ts` وفق القياس، بعد F3.
- Modify عند وجود حاجة مثبتة لفهرس: Prisma schema المقابل وmigration إضافية منفصلة؛ لا إعادة ترتيب migrations القديمة.
- Reuse/extend: `apps/backend/src/infrastructure/telemetry/app-metrics.service.ts` و`db-metrics.service.ts`.
- Create: `apps/backend/scripts/performance/report-benchmark.ts` و`docs/operations/report-capacity.md` و`docs/operations/financial-event-monitoring.md`.
- Test: report builder specs الموجودة وreal-DB reconciliation منF3؛ export fixture normalization يتجاهل timestamps/ترتيب خصائص غير دلالي فقط.

**العقد الأساسي:** JSON/Excel نفس الأعمدة والأسماء والوحدات والصلاحيات والأرقام المقبولة فيF3. aggregation فيPostgres؛ recent/details محدودة أوcursor pagination. لا hidden row limit يقص التقرير ويعرضه كاملًا، ولا منع نطاق تاريخي كان مستخدمًا دون بديل معتمد.

- [ ] **O4.1 — benchmark قابل للإعادة.** dataset صناعي بحجم مقارب للحالي ثم10×، بنفس نسب booking/payment/refund، وحمل1/5/10 طلبات تقرير متزامنة مع حمل حجز طبيعي. سجل wall time,p50/p95,RSS,DB time,rows read/returned,query plan,queue lag. لا load على الإنتاج أو نسخPII إلى اللابتوب افتراضيًا.
- [ ] **O4.2 — أزل المجاميع من Node.** SUM/COUNT/GROUP BY parameterized بنفس scopes وsemantics؛ join الاستردادات والدفعات بعد التجميع لمنع ضرب الصفوف. comparator على fixture F3 يؤكد تطابق كل مجموع قبل قبول تحسين الزمن. SQL performance لا يعوض رقمًا خاطئًا.
- [ ] **O4.3 — فهارس حسب EXPLAIN.** مرشح invoice branch/employee مع timestamp المناسب، وpayment/refund FK/status/time حسب selectivity؛ لا فهرس لكل filter تلقائيًا. وثق تكلفة write/storage ووقت البناء بالـrehearsal. استخدام CONCURRENTLY عند الحاجة يتبع runbook مراجعًا ومتوافقًا مع Prisma migrations.
- [ ] **O4.4 — صدّر بأثر ذاكرة محدود.** cursor/streaming للصفوف، batching لأسماء العملاء والخدمات بدلN+1، وقف العمل عندabort حيث آمن، timeout واضح. لا حفظ ملف في bucket عام. Excel formula injection: نصوص العملاء التي تبدأ =,+,-,@ تعامل كنص أثناء التصدير، دون تغيير النص المخزن.
- [ ] **O4.5 — قرر job وفق القياس.** إذا ظل التصدير المطلوب يتجاوز deadline الفعلي للproxy أو ميزانية الذاكرة بعد streaming، نفذ المسار الإضافي أدناه. إذا بقي ضمن الميزانية، وثق القياس ولا تضف queue جديدة بلا حاجة.
- [ ] **O4.6 — رصد مالي محدود الحساسية.** أضف counters/gauges لعددoutbox_PENDING/FAILED حسب eventType/consumer، عمر أقدم pending، invoice/booking mismatch، overcollection candidates، provider unknown/refund manual review، DB pool saturation/deadlocks. لا bookingId/paymentId/email labels في Prometheus لتجنب cardinality وتسريب البيانات؛ correlation identifiers في سجلات محمية فقط.
- [ ] **O4.7 — ميزانية التوسع.** القيمة الحالية pool max25 لكل backend process؛ احسب إجمالي API+workers+cron+CI/admin قبل زيادة replicas. كرون leader lease وworker concurrency وgraceful shutdown تختبر على نسختين في staging. فصل worker process خيار لاحق إذا أثبت الحمل تزاحمHTTP، لا microservices ولا إعادة قاعدة البيانات.
- [ ] **O4.8 — قبول performance.** الأرقام صحيحة، وRSS لا ينمو مع تحميل كل rows دفعة واحدة، ولا regressions في booking/payment p95 تحت حمل التقرير. targets النهائية تعتمد baseline وموارد التشغيل؛ لا وعد بعدد مستخدمين من سعةpool وحدها.

### المسار المشروط للتصدير الخلفي — ضمن O4 إذا تحقق شرط القياس

**ملفات جديدة مقترحة:**

- `apps/backend/src/modules/ops/report-export/request-report-export.handler.ts` و`report-export.processor.ts` و`get-report-export.handler.ts` وspecs المجاورة.
- `apps/backend/src/api/dashboard/report-exports.controller.ts` مع DTOs موثقة.
- نموذج `ReportExportJob` في `apps/backend/prisma/schema/ops.prisma` ومهاجرة إضافية: id/createdBy/normalizedFilters/status/objectKey/errorCode/createdAt/expiresAt، دون report payload محمّل في صف واحد.
- `apps/dashboard/hooks/use-report-export.ts` وتعديل زر التصدير الحالي في صفحة التقرير فقط.

**العقد الإضافي:** POST `/api/v1/dashboard/report-exports` يرجع 202 و`{id,status:'QUEUED'}`؛ GET `/:id` يرجع `{id,status:'QUEUED'|'RUNNING'|'READY'|'FAILED'|'EXPIRED',expiresAt}`؛ GET `/:id/download` يتحقق من صاحب الطلب وصلاحية قراءة التقرير ونطاق المرشحات الحالي، ثم يقدم الملف مباشرة أو رابطًا موقّعًا قصير العمر. لا تغيير endpoint التصدير الحالي من 200 إلى 202 بطريقة تكسر عملاءه.

- [ ] أضف اختبارات ملكية job، وفلترة النطاق، وretry بلا ملفات مكررة، وتعطل worker، وانتهاء الرابط، وتغير صلاحية صاحب الطلب قبل التنزيل.
- [ ] نفذ idempotency لطلب export نفسه خلال جلسة التنزيل بمعرف طلب محدد، واحفظ الملف في MinIO خاص؛ object key غير قابل للتخمين ولا يحتوي اسم عميل. صلاحية الرابط خمس دقائق والملف 24 ساعة كقيم مقترحة تعتمد قبل الطرح.
- [ ] worker يأخذ snapshot متسقًا عبر معاملة قراءة مناسبة، ويسجل الوقت والمرشحات التي ولدت منها النتائج، ويتحقق من التفويض وقت التنفيذ والتنزيل. لا يجمع صفحات من حالات مختلفة ويصفها كتقرير لنقطة زمنية واحدة؛ تكلفة المعاملة الطويلة تُقاس ضمن benchmark.
- [ ] الواجهة تحافظ على نفس الزر؛ أثناء الانتظار تعرض «جارٍ تجهيز الملف» وتنزّله عند الجاهزية، مع إعادة محاولة export فقط عند الفشل. لا صفحة جديدة أو إجراء جديد على الموظف.
- [ ] اختبر backend القديم مع frontend القديم، والجديد بعد توفر endpoint؛ تأخر job أو اختفاؤه لا يرجع ملفًا ناقصًا بنجاح 200. تنظيف الملفات المنتهية سياسة محددة لملفات export المؤقتة فقط، ولا تمس ملفات العملاء.

**طرح O4:** تغييرات القراءة والتجميع أولًا، ثم الفهارس، ثم job فقط إن احتيج. rollback للواجهة يبقي jobs القائمة حتى تنتهي أو تنتهي صلاحيتها؛ لا حذف لها لإنجاح الرجوع. لا توسع للـworkers دون ميزانية اتصالات وصلاحيات تخزين.

## دليل إغلاق الحزمة

- [ ] CI critical lane إلزامية ومثبتة بنتيجة جديدة؛ اختبار نقل حقيقي يبرهن outbox بعد تعطل Redis.
- [ ] دورة الاعتماد المستهدفة واستيرادات البنية المعكوسة أزيلت، وقواعد feature boundaries تكشف المخالفات الفعلية.
- [ ] مقارنة قبل/بعد للتقارير على dataset واحد تثبت صحة الأرقام وتحسن أو كفاية الأداء.
- [ ] runbooks للأحداث والمصالحة والنشر محفوظة دون أسرار، ومراقبة الإنتاج لا تُعلن مكتملة دون الوصول والدليل.
