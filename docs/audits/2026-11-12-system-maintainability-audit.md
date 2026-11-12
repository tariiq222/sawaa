# تدقيق قابلية الصيانة والتطوير — نظام سواء

> **نوع المستند:** لقطة تدقيق مؤرخة. لا تُعدَّل نتائجها بعد 12 نوفمبر 2026 إلا لتوضيح تصحيح لاحق. التنفيذ والمتابعة في [خطة الإصلاح](../plans/maintainability-roadmap.md).
> **خط الأساس:** `develop` = `origin/develop` عند `e48586e5279fc39897b3a9e1aa8222329c038a49`، وشجرة العمل نظيفة.
> **النطاق:** الخلفية، اللوحة، الموقع، الجوال، الحزم المشتركة، قاعدة البيانات، الاختبارات، CI، الاعتمادات، التوثيق.
> **التقرير السابق:** [تحليل 9 يوليو 2026](../system-analysis-report-2026-07-09.md). هذا التدقيق يركز على قابلية الصيانة والتطوير، لا على الأمن.

## 1. الخلاصة

النظام سليم تشغيليًا ولا يحتاج إعادة كتابة. الخطر على الصيانة والتطوير يتركز في نمط واحد: **الحقيقة الواحدة معرّفة في أكثر من مكان** (أنواع الـAPI، مسارات العميل، قواعد التحقق، التوثيق)، وحدود الوحدات في الخلفية غير مفروضة بأداة.

أبرز أعراضه: من 897 commit منذ 12 يوليو 2026، 309 إصلاح مقابل 124 ميزة و17 refactor.

## 2. المنهج وحدود التحقق

| الفحص | النتيجة |
|---|---|
| `pnpm typecheck` | نجح 8/8، كلها من كاش Turbo |
| `pnpm lint` | صفر أخطاء، 72 تحذيرًا (الخلفية 60، اللوحة 8، الموقع 4) |
| `node scripts/check-dashboard-api-drift.mjs` | نجح، 180 استدعاء مطابق |
| `node scripts/check-api-client-drift.mjs` | نجح، 83 نقطة مطابقة |
| `node scripts/check-legacy-multitenant.js` | نجح |
| تطابق ترجمة اللوحة (`i18n:verify`) | نجح |
| آخر تشغيل `merge-gate` على GitHub (11 نوفمبر 2026) | ناجح |

**لم يُشغَّل:** اختبارات الوحدة، e2e، البناء، Playwright، Moyasar sandbox.
**لم يُفحص:** الأداء الحي، حجم الحزم، الأمن بعمق، بيئة الإنتاج.

كل رقم في هذا المستند ناتج عدّ آلي على الكود عند خط الأساس. طريقة كل قياس في [الملحق](#9-ملحق-طريقة-القياس).

## 3. حجم النظام

| المكوّن | ملفات المصدر | أسطر المصدر | ملفات الاختبار | أسطر الاختبار |
|---|---:|---:|---:|---:|
| `apps/backend` | 1,241 | 131,238 | 953 | 132,491 |
| `apps/dashboard` | 761 | 129,328 | 381 | 53,610 |
| `apps/website` | 225 | 24,625 | 105 | 15,705 |
| `apps/mobile` | 384 | 28,122 | 242 | 23,950 |
| `packages/shared` | 61 | 2,518 | 13 | 1,852 |
| `packages/api-client` | 35 | 3,436 | 12 | 2,943 |
| `packages/ui` | 43 | 3,990 | 13 | 1,928 |

- من أسطر اللوحة: 45,184 ملف أنواع مولَّد و9,887 ترجمة.
- قاعدة البيانات: 103 نماذج، 77 enum، 122 ترحيلة.
- الـAPI: 470 عملية في `openapi.json`، 82 controller، 422 handler (وسيط الحجم 63 سطرًا).
- الاختبارات: نحو 13.9 ألف حالة (الخلفية 7,957 وحدة و515 e2e، اللوحة 2,400 و189 e2e، الموقع 847، الجوال 1,470، الحزم 488).

## 4. بطاقة التقييم

| المجال | التقييم | السبب |
|---|---|---|
| صحة الكود الحالية | قوي | لا `@ts-ignore` إطلاقًا، 44 `any` في الخلفية، TODO واحد في كل المشروع |
| بنية الخلفية | جيد | vertical slices واضحة، لكن الحدود بين الوحدات غير مفروضة |
| عقود الـAPI والأنواع | ضعيف | أربعة مصادر يدوية للأنواع، والملف المولَّد شبه غير مستخدم |
| الاختبارات | قوي في الخلفية، متوسط في اللوحة | 43 ملف e2e بقاعدة حقيقية يحجب الدمج؛ عتبة تغطية اللوحة 33% |
| CI والنشر | جيد | مسار نشر صارم بإيصالات؛ البوابة لا تشغّل ESLint ولا اختبارات الحزم |
| الاعتمادات | متوسط | 68 override و8 patches، وحزمة `shared` تتبع workspaceين |
| التوثيق | متوسط | غزير (275 ملفًا) وفيه تناقضات مع الواقع |

## 5. خط الأساس الرقمي

هذه المقاييس تتابعها الخطة. أهدافها في [جدول الأهداف](../plans/maintainability-roadmap.md#4-المقاييس-والأهداف).

| المقياس | القيمة في 12 نوفمبر 2026 |
|---|---|
| ESLint يحجب الدمج للخلفية واللوحة والموقع | لا |
| اختبارات الحزم الثلاث في البوابة | لا |
| عمليات OpenAPI بلا مخطط استجابة ناجحة مفصّل | 224 من 470 (187 بلا مخطط، 37 بلا استجابة ناجحة) |
| ملفات تستورد `api.generated.ts` في اللوحة | 2 |
| ملفات أنواع يدوية في `apps/dashboard/lib/types` | 37 |
| ملفات أنواع يدوية في `packages/api-client/src/types` | 24 |
| ملفات أنواع في `apps/mobile/types` | 6 |
| مواضع تعريف `BookingStatus` | 4 |
| واجهات API للعميل | 3 |
| أزواج وحدات تستورد من بعضها في الاتجاهين | 8 |
| استدعاءات `forwardRef` | 4 في 3 وحدات |
| كتابات Prisma من وحدة غير مالكة للجدول | 133 من 656 (20.3%)، منها 39 على جداول `ops` المشتركة |
| قراءات Prisma من وحدة غير مالكة | 453 من 1,250 (36.2%) |
| أكبر controller | 1,144 سطرًا، 42 مسارًا، 37 اعتمادًا |
| handlers بحجم 500 سطر فأكثر | 7 |
| handlers بحجم 300–499 سطرًا | 17 |
| مراجع `RlsTransactionService` خارج الاختبارات | 299 في 149 ملفًا |
| تحذيرات lint | 72 |
| عتبة تغطية اللوحة (statements) | 33% |
| عمال اختبارات اللوحة | 1 (إجباري بسبب OOM) |
| زمن `gate` | نحو 20 دقيقة، مهمة واحدة تسلسلية |
| overrides (الجذر + الجوال) | 52 + 16 |
| patches (الجذر + الجوال) | 3 + 5 |

## 6. النتائج

### F-01 — لا يوجد مصدر واحد لعقد الـAPI

**الدليل:**
- [`api.generated.ts`](../../apps/dashboard/lib/types/api.generated.ts) حجمه 45,184 سطرًا ويستورده ملفان: `lib/api/openapi.ts` و`lib/types/intake-form-api.ts`.
- الأنواع مكتوبة يدويًا في أربعة أماكن: `apps/dashboard/lib/types` (37 ملفًا)، `packages/api-client/src/types` (24)، `apps/mobile/types` (6)، `packages/shared/types` (17).
- `BookingStatus` معرّف في `bookings.prisma` و`apps/dashboard/lib/types/booking.ts` و`apps/mobile/types/booking-enums.ts` و`packages/api-client/src/types/booking.ts`.
- من 470 عملية في `openapi.json`: 246 لها مخطط استجابة ناجحة مفصّل، 187 بلا مخطط، 37 بلا استجابة ناجحة موثقة.
- دالتان فقط في الـcontrollers لهما نوع إرجاع صريح، فلا يتحقق المترجم من مطابقة الاستجابة الفعلية للـDTO الموثق.
- سكربتا drift يتحققان من المسار والـmethod فقط، كما تقول ترويستاهما.
- قواعد التحقق مكررة: class-validator في الخلفية (215 ملف DTO) وzod في اللوحة (34 ملفًا).

**الأثر:** تغيير حقل واحد يتطلب تعديل 3–5 ملفات يدويًا، ولا شيء يكشف النسيان قبل الإنتاج.

**البنود:** MNT-06، MNT-08، MNT-09، MNT-15، MNT-21.

### F-02 — ثلاث واجهات API للعميل نفسه

**الدليل:**
- `/client`: 54 مسارًا في 11 controller. `/mobile/client`: 56 مسارًا في 15 controller. إضافة إلى عائلة `/public/me`.
- الموقع و`api-client` والجوال في المستودع تستدعي `/client` فقط (5 و26 و34 موضعًا)، وصفر للمسارين القديمين.
- [`client/chat.controller.ts`](../../apps/backend/src/api/client/chat.controller.ts) و[`public/my-chat.controller.ts`](../../apps/backend/src/api/public/my-chat.controller.ts) نسختان من 255 سطرًا تختلفان في 4 أسطر.
- `CLIENT_LEGACY_PREFIX_SUNSET` معلّق في `apps/backend/.env.example`. العدّاد `sawaa_client_api_legacy_prefix_requests_total` موجود.
- اختلاف قواعد الإلغاء حسب القناة أُزيل: لا أثر لـ`legacyChannel` في الكود.

**الأثر:** كل ميزة عميل تُصان في ثلاثة أماكن إلى أن يُحدَّد تاريخ الإيقاف.

**البنود:** MNT-11، MNT-22. التفاصيل التاريخية في [توحيد API العميل](../architecture/client-api-unification.md).

### F-03 — حدود الوحدات في الخلفية غير مفروضة

**الدليل:**
- ثمانية أزواج تستورد من بعضها في الاتجاهين (عدد جمل الاستيراد في كل اتجاه):

| الزوج | الاتجاه الأول | الاتجاه الثاني |
|---|---:|---:|
| bookings ↔ finance | 23 | 9 |
| finance ↔ org-experience | 11 | 9 |
| identity ↔ platform | 11 | 2 |
| comms ↔ identity | 1 | 8 |
| identity ↔ people | 1 | 7 |
| comms ↔ people | 2 | 4 |
| bookings ↔ org-experience | 2 | 2 |
| org-config ↔ people | 1 | 1 |

- أكبر أزواج الكتابة العابرة (مواضع/ملفات): identity → people 27/19، bookings → finance 11/7، finance → bookings 10/5، people → organization 6/3.
- `booking` و`invoice` و`payment` يكتب في كل منها ثلاث وحدات. الجدولان `activityLog` و`outboxEvent` تكتب فيهما وحدات كثيرة بالتصميم.
- طبقات معكوسة: `common/guards/casl.guard.ts` يستورد من `modules/identity`، وملفان في `infrastructure/ai` يستوردان من `modules/ai`.
- [`eslint.config.mjs`](../../apps/backend/eslint.config.mjs) للخلفية بلا قاعدة حدود، مع أن تعليقه يذكر أنها تنتمي إليه. اللوحة لديها قاعدة مماثلة.
- قاعدة `apps/backend/CLAUDE.md` ("النداء بين الوحدات عبر ما تصدّره الوحدة") لا يفرضها شيء.

**الأثر:** تغيير في جدول مالي قد يكسر كود الحجوزات دون أن يظهر في مراجعة وحدة المالية.

**البنود:** MNT-05، MNT-17، MNT-19.

### F-04 — Controllers سمينة وhandlers عملاقة وتسجيل يدوي

**الدليل:**

| الـController | الأسطر | المسارات | الاعتمادات المحقونة |
|---|---:|---:|---:|
| `api/dashboard/people.controller.ts` | 1,144 | 42 | 37 |
| `api/dashboard/organization-settings.controller.ts` | 444 | 31 | 31 |
| `api/dashboard/finance.controller.ts` | 599 | 28 | 28 |
| `api/dashboard/bookings.controller.ts` | 651 | 23 | 23 |
| `api/dashboard/comms.controller.ts` | 413 | 23 | 23 |

| الـHandler | الأسطر |
|---|---:|
| `finance/refund-payment/refund-payment.handler.ts` | 1,051 |
| `finance/package-purchases/init-package-purchase/init-package-purchase.handler.ts` | 786 |
| `bookings/create-booking/create-booking.handler.ts` | 673 |
| `bookings/book-from-credit/book-from-credit.handler.ts` | 661 |
| `finance/moyasar-payment-settlement/moyasar-payment-settlement.handler.ts` | 547 |
| `comms/chat/operations/confirm-operation.handler.ts` | 544 |
| `finance/moyasar-webhook/moyasar-webhook.handler.ts` | 512 |

- دالة `execute` في `create-booking` تمتد نحو 450 سطرًا (من السطر 70 إلى 522).
- `comms.module.ts` (253 سطرًا) تغيّر 18 مرة منذ يوليو لأن كل handler يُسجَّل يدويًا. يليه `identity.module.ts` (199) و`bookings.module.ts` (175).

**الأثر:** أكثر الملفات حساسية هي أصعبها قراءة واختبارًا، وهي نفسها المحمية بقاعدة "لا refactor للتجميل".

**البنود:** MNT-10، MNT-18، MNT-20.

### F-05 — بوابة الدمج تترك فجوات

**الدليل:**
- خطوة "Lefthook pre-push (eslint + typecheck + multi-tenant guard)" في [`merge-gate.yml`](../../.github/workflows/merge-gate.yml) (السطر 177) تشغّل مهام `pre-push` في `lefthook.yml`، وهي حجب الدفع المباشر و`pnpm typecheck` فقط. ESLint وفحص multi-tenant معرّفان في `pre-commit`.
- ESLint الخلفية، ومنه القاعدة `sawaa/require-api-operation`، لا يعمل في CI.
- ESLint اللوحة والموقع يعمل داخل `next build` في `build-images.yml`. هذا الـworkflow يعمل على PR فقط عند تغيير ملفات Docker أو النشر، فالفحص يقع بعد الدمج.
- خارج البوابة: اختبارات `shared` و`api-client` و`ui` (488 حالة)، `check-dashboard-api-drift`، تطابق الترجمة، اختبارات outbox مع Redis، وPlaywright smoke (محلي عبر `pnpm test:premerge`).
- `gate` مهمة واحدة تسلسلية؛ آخر إيصال سجّل 20 دقيقة و26 ثانية.

**الأثر:** قواعد البنية تعتمد على hook محلي يمكن تجاوزه بـ`LEFTHOOK=0`.

**البنود:** MNT-01، MNT-14.

### F-06 — هشاشة في الحزم والاعتمادات

**الدليل:**
- `packages/shared` عضو في workspaceين: الجذر (`node-linker=hoisted`) و`apps/mobile` (`nodeLinker: isolated` بملف lock مستقل). كلاهما يكتب في `packages/shared/node_modules`؛ رابط `zod` فيه يشير حاليًا إلى مخزن الجوال (4.6.5) والجذر عنده 4.6.1.
- `packages/shared/dist/schemas/*.js` تستدعي `require("zod")`، والخلفية تستورد من `@sawaa/shared/schemas`، لكن zod مسجّل في `devDependencies` فقط. يعمل لأن صورة الخلفية تنسخ `node_modules` كاملة؛ ترويسة الـDockerfile تخطط للانتقال إلى `pnpm deploy`.
- `shared` على zod 4، واللوحة والجوال على zod 3.
- `@types/react` مثبت على 18.3.28 بـoverride مع React 19.2.4. `eslint-config-next` 16.4.0 مع Next 15.5.28.
- في اللوحة: `next-intl` و`jose` و`eslint-plugin-boundaries` معلنة بلا أي استخدام.
- `.nvmrc` يقول 22، وCI وDocker على 22، ولا يوجد حقل `engines`. جهاز التطوير يعمل على Node 26.12.1.
- في `.trivyignore.yaml`: استثناء `braces@3.0.3` انتهى في 17 أكتوبر 2026 والحزمة ما زالت في `pnpm-lock.yaml` والبوابة ناجحة؛ السبب لم يُتحقق منه. استثناء `decode-uri-component` ينتهي في 30 نوفمبر 2026.

**الأثر:** نتيجة `pnpm install` المحلية تعتمد على ترتيب تشغيله، والاختبار المحلي يجري على إصدار Node غير إصدار الإنتاج.

**البنود:** MNT-02، MNT-03، MNT-07، MNT-15، MNT-21.

### F-07 — بقايا تسميات multi-tenant

**الدليل:**
- `RlsTransactionService` مستخدم في 149 ملفًا (299 مرجعًا)، وتعليقه في [`rls-transaction.ts`](../../apps/backend/src/common/database/rls-transaction.ts) يقول إنه صار غلافًا رقيقًا لـ`$transaction`.
- رسائل ESLint في الخلفية (الأسطر 79–97) تذكر `$allTenants` و`SuperAdminContextInterceptor`، وتستثني ملفين غير موجودين (السطران 129–130).
- `organizationId` باقٍ في 81 ملفًا و`DEFAULT_ORG_ID` في 48. بقاؤهما مقصود بقواعد السلامة في `AGENTS.md`.

**الأثر:** الأسماء توحي بسلوك لم يعد موجودًا، فتضلل القارئ الجديد وأدوات الذكاء الاصطناعي.

**البنود:** MNT-04، MNT-12.

### F-08 — الواجهات

**الدليل:**
- **اللوحة:** عتبات التغطية 33/24/31/34 (statements/branches/functions/lines). `vitest.config.ts` يفرض `maxWorkers: 1` وذاكرة 6144MB بسبب OOM. قائمة `FEATURES` في ESLint فيها 5 أسماء بلا مجلدات: `branches`، `groups`، `patients`، `practitioners`، `whatsapp`.
- **الموقع:** [`dictionary.ts`](../../apps/website/features/locale/dictionary.ts) (1,566 سطرًا) أكثر ملف تغيّرًا منذ يوليو (26 مرة). [`use-booking-wizard.ts`](../../apps/website/features/booking/use-booking-wizard.ts) 932 سطرًا.
- **الجوال:** طبقة خدمات (`apps/mobile/services`، 34 ملفًا) وأنواع مستقلة، ولا يعتمد على `@sawaa/api-client`.

**الأثر:** كل مسار عميل منفَّذ مرتين (الموقع عبر `api-client` والجوال عبر خدماته)، واختبارات اللوحة بطيئة وتغطيتها منخفضة.

**البنود:** MNT-21، MNT-23، MNT-24.

### F-09 — اختبارات الوحدة مرتبطة بالتنفيذ

**الدليل:** في 943 ملف spec في الخلفية يوجد 4,691 `jest.fn()`. 8 ملفات فقط تستخدم mock مشتركًا لـPrisma. شبكة الأمان الفعلية هي 60 ملف e2e بقاعدة حقيقية، 43 منها تحجب الدمج.

**الأثر:** إعادة الهيكلة الداخلية تكسر اختبارات كثيرة دون تغيّر السلوك، فترتفع كلفة أي تحسين.

**البنود:** MNT-25.

### F-10 — تناقضات في التوثيق

**الدليل:**

| الموضع | ما يقوله | الواقع |
|---|---|---|
| `.github/retired-workflows/README.md:5` | GitHub Actions معطّل | يعمل؛ آخر `merge-gate` ناجح في 11 نوفمبر |
| `.github/dependabot.yml:9` | GitHub Actions معطّل | يعمل |
| `.github/workflows/merge-gate.yml:1-2` | توجد مهام CI منفصلة | `ci.yml` في `retired-workflows` |
| `.github/RELEASE.md:25` | يشترط مهام `dashboard-smoke` و`outbox-transport` و`release-integrity` | غير موجودة في `workflows/` |
| `docs/operations/migration-charter.md:15,90` | فحص الترحيلات يعمل في `ci.yml` | يعمل في `merge-gate.yml` فقط |
| `AGENTS.md:43` | `packages/api-client/AGENTS.md` | الملف اسمه `CLAUDE.md` |
| `apps/backend/CLAUDE.md:94` | عتبات التغطية 65/70/85 | الفعلية في `jest.config.ts` هي 70/80/88 |
| `apps/backend/CLAUDE.md:16,32,38` | وحدة `content` وشرائح `waitlist` و`walk-in` | غير موجودة |

- `AGENTS.md` (143 سطرًا) و`CLAUDE.md` (218 سطرًا) في الجذر يختلفان في 111 سطرًا.
- في `docs/` 275 ملف Markdown (40,352 سطرًا)، منها 137 تحت `superpowers/`.

**الأثر:** أدوات الذكاء الاصطناعي تعامل هذه الملفات كقانون، فالتناقض يُنتج قرارات خاطئة.

**البنود:** MNT-04، MNT-16، MNT-26.

## 7. نقاط القوة التي يجب الحفاظ عليها

- مسار النشر بالإيصالات واختبار الاستعادة قبل كل إنتاج.
- 43 ملف e2e بقاعدة حقيقية يحجب الدمج.
- المصادقة المغلقة افتراضيًا: `JwtGuard` عام و`@Public()` استثناء صريح.
- حافلة الأحداث مع outbox وطابور مستقل لكل مستهلك.
- قواعد الحدود في ESLint اللوحة، وآلية الـbaseline في `check:openapi-coverage`.
- وسيط حجم الـhandler 63 سطرًا: معظم الشرائح صغيرة وواضحة.

## 8. حالة بنود تقرير 9 يوليو

فحص سريع بقراءة الكود، دون إعادة اختبار:

| البند | الملاحظة |
|---|---|
| 1. تسريب صفوف `Client` للموظف | يوجد `EmployeeClientResponseDto` |
| 2. الصلاحيات الفارغة تعيد الافتراضية | القائمة الفارغة تُعامل كمنع كامل في `casl-ability.factory.ts` |
| 3. 2FA لا يفرض عاملين | **لم يُفحص** |
| 4. سباق refresh في الجوال | يوجد وعد مشترك `refreshAccessTokenPromise` |
| 5. ازدواج نسخ القياسات | `TelemetryModule` واحد يصدّر الخدمتين |
| 6. الإغلاق لا ينتظر الطلبات | يوجد `RequestTracker` مع اختبار |
| 7. CI لا يمنع تعديل الترحيلات | يوجد `check-prisma-migration-immutability.mjs` في البوابة |

## 8.1 تصحيحات لاحقة

- **الكتابات العابرة:** 135 لا 133، و96 لا 94 دون جداول `ops`. القياس الأصلي لم يلتقط موضعين في `finance/moyasar-webhook/moyasar-webhook.handler.ts` يمتد فيهما الاستدعاء على سطرين. فحص MNT-05 يلتقطهما.
- **الاستجابات غير المفصّلة:** فحص MNT-06 يستثني 35 عملية توثّق 204 فقط لأنها بلا جسم، فخط الأساس المقفل 187 (185 بلا مخطط مفصّل و2 بلا استجابة ناجحة).

## 9. ملحق: طريقة القياس

- **الأسطر والملفات:** `git ls-files` لامتدادي `.ts` و`.tsx`. ملفات الاختبار هي ما يطابق `.spec.` أو `.test.`.
- **حالات الاختبار:** عدّ الأسطر التي تبدأ بـ`it(` أو `test(`، ومنها `.each`.
- **استيراد الوحدات:** حل كل استيراد نسبي في `apps/backend/src` خارج ملفات الاختبار إلى مساره، ثم تصنيفه حسب `modules/<اسم>`. الزوج ثنائي الاتجاه إذا وُجد استيراد واحد على الأقل في كل اتجاه.
- **ملكية الجداول:** النموذج تملكه الوحدة المطابقة لاسم ملف الـschema. نماذج `organization.prisma` تُحسب مملوكة لـ`org-config` و`org-experience` معًا.
- **مواضع Prisma:** مطابقة النمط `(prisma|tx|client|db|trx).<model>.<operation>` خارج ملفات الاختبار. الكتابة: `create`، `createMany`، `update`، `updateMany`، `upsert`، `delete`، `deleteMany`.
- **الاعتمادات المحقونة:** عدد معاملات الـconstructor ذات محدد وصول.
- **استجابات OpenAPI:** العملية "مفصّلة" إذا كان لاستجابة 200 أو 201 مخطط JSON فيه `$ref` أو `properties` أو `items` أو `allOf` أو `oneOf`.
- **التغيّر:** `git log --since=2026-07-12 --name-only` على `apps` و`packages`، دون ملفات الاختبار والمولَّدات.
- **أنواع الـcommits:** بادئة عنوان الـcommit منذ 12 يوليو 2026.

سكربتات القياس لم تُحفظ في المستودع. البند MNT-05 يضيف نسخة دائمة لقياسي الاستيراد والكتابة العابرة.
