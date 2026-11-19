# تسليم MNT-21 — الجوال: عقد موحّد وworkspace واحد

**التاريخ:** 2026-11-19  
**الفرع الأساس:** `integration/maintainability` عند `ebde0b6e2`  
**الحالة:** جاهز لكتابة ADR — لم يُنفَّذ أي تغيير على workspace أو الاعتمادات.

## الهدف

1. **عملية تثبيت واحدة فقط** تكتب في `packages/shared/node_modules`.
2. **مصدر واحد** لنوع `BookingStatus` في واجهات التطبيقات.
3. الجوال يستورد الأنواع من `@sawaa/api-client` بدل التعريفات المكررة، دون كسر بناء TestFlight.

**معيار القبول:** `pnpm install` واحد من الجذر لا يترك أي عملية تثبيت ثانية تكتب في `packages/shared/node_modules`، و`BookingStatus` له تعريف واحد للواجهات، و`pnpm --dir apps/mobile typecheck` و`lint` و`test` ناجحة، وبناء TestFlight ناجح.

## الحالة الحالية

**غير جاهز للتنفيذ قبل ADR.** السبب: الجوال workspace مستقل بقفل مستقل و`nodeLinker` مختلف، وضمّه إلى الجذر يغيّر شجرة الاعتمادات الأصلية ويحتاج إثبات بناء iOS. لا يوجد اليوم أي اعتماد مباشر على `@sawaa/api-client` في `apps/mobile/package.json`.

### القياس الفعلي (2026-11-19)

| الحقيقة | القيمة | الدليل |
|---|---|---|
| الجوال عضو في workspace الجذر؟ | **لا** | `pnpm-workspace.yaml` الجذري لا يضم `apps/mobile` |
| workspace الجوال | `.` و`../../packages/shared` | `apps/mobile/pnpm-workspace.yaml` |
| `nodeLinker` للجوال | `isolated` | `apps/mobile/pnpm-workspace.yaml` |
| `nodeLinker` للجذر | `hoisted` | `.npmrc` |
| قفل الجذر | `pnpm-lock.yaml` (769,033 بايت) | `ls -l` |
| قفل الجوال | `apps/mobile/pnpm-lock.yaml` (478,731 بايت) | `ls -l` |
| `postinstall` في الجوال | `pnpm --filter @sawaa/shared build` | `apps/mobile/package.json` |
| ملفات تستورد أنواع الجوال المحلية | 62 ملفًا | `rg -l "@/types/(models|auth|chat|api|booking-enums)"` |
| `BookingStatus` | 4 تعريفات | Prisma + api-client + dashboard + mobile |
| استيراد `api-client` من الجوال | ملفان بمسار نسبي إلى `src/types/cancellation` | `apps/mobile/services/client/bookings.ts` و`booking-cancellation.ts` |

### تعريفات `BookingStatus` الأربعة

- **قاعدة البيانات:** `apps/backend/prisma/schema/bookings.prisma` — `enum BookingStatus` بـ10 قيم.
- **api-client:** `packages/api-client/src/types/booking.ts` — `Lowercase<Schemas['BookingStatus']>` مشتق من لقطة OpenAPI.
- **اللوحة:** `apps/dashboard/lib/types/booking.ts` — تعريف محلي منفصل.
- **الجوال:** `apps/mobile/types/booking-enums.ts` — تعريف محلي منفصل.

> `packages/shared` لا يصدّر `BookingStatus` اليوم. لذلك «المصدر الواحد» يجب أن يكون `packages/api-client` أو `packages/shared`، لا تعريفًا جديدًا.

### لماذا الوضع الحالي هش

- `packages/shared` عضو في workspaceين بقفلين و`nodeLinker` مختلفين؛ كلاهما قد يكتب في `packages/shared/node_modules`، ونتيجة التثبيت تعتمد على ترتيب التشغيل.
- `postinstall` في الجوال يشغّل بناء `shared` من داخل workspace الجوال، أي أن التثبيت له أثر جانبي على حزمة مشتركة.
- الجوال لا يستطيع استيراد `@sawaa/api-client` اليوم لأنه ليس اعتمادًا، و`tsconfig` لا يعرّف مسارًا له، و`api-client` يشير إلى `src/index.ts` لا إلى `dist`.
- استيراد ملفين بمسار نسبي إلى `packages/api-client/src` يعمل محليًا لكنه ليس عقدًا رسميًا، ويكسر إذا تغيّر هيكل الحزمة أو نُشرت.
- `api-client` نفسه يعتمد على `@sawaa/shared` بـ`workspace:*`، فأي محاولة لتثبيته خارج workspace الجذر تصطدم بغياب `shared` من نفس الـworkspace.

## ما أُنجز مع دليل

- **جرد workspace والقفلين** — قراءة `pnpm-workspace.yaml` و`apps/mobile/pnpm-workspace.yaml` و`.npmrc` و`package.json` في الجذر والجوال.
- **جرد الاعتمادات** — `apps/mobile/package.json` لا يضم `@sawaa/api-client`؛ يضم `@sawaa/shared` بـ`workspace:*`.
- **جرد الاستيرادات** — `rg -n '@sawaa/api-client|api-client' apps/mobile` يثبت وجود مسارين نسبيين فقط.
- **جرد الأنواع** — `rg -n 'BookingStatus' packages/api-client apps/mobile apps/dashboard apps/backend/prisma/schema` يثبت التعريفات الأربعة.
- **حارس العقد** — `packages/api-client/src/types/booking.test.ts` يثبت تطابق `BOOKING_STATUSES` مع لقطة OpenAPI (`BookingStatus` enum) ويفشل عند الانحراف.
- **مسار البناء** — `.github/workflows/apple-testflight.yml` و`scripts/apple-release/build-ios.sh` يثبتان أن بناء iOS يشغّل `pnpm install --frozen-lockfile` ثم `pnpm --dir apps/mobile install --frozen-lockfile` ثم يبني `shared`.
- **البوابة الحالية** — `.github/workflows/merge-gate.yml` تشغّل lane مستقلة للجوال: تثبيت الجذر ثم تثبيت الجوال ثم typecheck/lint/test.

**غير مُتحقق:** لم يُشغَّل `pnpm --dir apps/mobile typecheck` ولا `lint` ولا `test` في هذه الجلسة، ولم يُبنَ TestFlight. لا توجد قياسات لتأثير ضمّ الجوال على زمن التثبيت أو حجم `node_modules`.

## ما تبقى

| # | المهمة | المالك | معيار الإنجاز |
|---|---|---|---|
| 21.1 | كتابة ADR يختار: **(أ) ضمّ الجوال إلى workspace الجذر** أو **(ب) إبقاؤه مستقلًا مع استهلاك `shared` و`api-client` كحزمة مبنية** | المالك + DeepSeek | ADR معتمد يحدد الخيار والبديل المرفوض ومخاطر الرجوع |
| 21.2 | تنفيذ الخيار المعتمد على فرع مستقل | DeepSeek | `pnpm install` واحد لا يكتب في `packages/shared/node_modules` أكثر من مرة |
| 21.3 | جعل `BookingStatus` مشتقًا من `@sawaa/api-client` في الجوال وحذف التعريف المحلي | DeepSeek | لا تعريف ثانٍ في `apps/mobile`، و`booking-enums.test` يمر |
| 21.4 | تحويل الاستيرادين النسبيين إلى استيراد رسمي من `@sawaa/api-client` | DeepSeek | صفر مسار `../../../../packages/api-client/src` في الجوال |
| 21.5 | توحيد أو توثيق الفرق بين `dashboard/lib/types/booking.ts` و`api-client` | DeepSeek | قرار موثق: اشتقاق أو استثناء مبرر |
| 21.6 | تعديل CI ومسار إصدار iOS لتثبيت واحد بدل تثبيتين | المالك (`.github/**` و`scripts/apple-release/**`) + DeepSeek | `gate/mobile` و`scripts/apple-release/build-ios.sh` ينجحان بخطوة تثبيت واحدة، والبوابة تبقى باسم `gate` |
| 21.6.1 | تحديث تعليق `metro.config.js` الذي ينص أن الجوال «intentionally NOT a pnpm-workspace member» | DeepSeek | التعليق يطابق الواقع الجديد، وMetro يجد `@sawaa/shared` |
| 21.7 | إثبات بناء TestFlight من فرع الاختبار بموافقة مالك، ثم تثبيت يدوي | المالك | تعديل workflow مؤقت موثق، بناء ناجح، تثبيت على جهاز واحد على الأقل، ثم إزالة التعديل |
| 21.7.1 | إذا رُفض تعديل workflow: توثيق أن TestFlight لم يُختبر قبل الدمج | المالك | قرار صريح في PR بأن القبول يكتمل بعد أول بناء على `develop` |
| 21.8 | تحديث `AGENTS.md` و`CLAUDE.md` إذا تغيّر أمر تشغيل الجوال | المالك | تعليمات الأدوات تطابق الواقع |

**خارج نطاق هذه المرحلة:** استبدال خدمات axios بدوال `api-client`. الخطة تنص على أنه «لاحقًا» وقرار منفصل. لا تخلطه مع 21.1–21.7.

## خيارا ADR

### الخيار أ — ضمّ الجوال إلى workspace الجذر (الموصى به للصيانة طويلة الأمد)

**كيف:** إضافة `apps/mobile` إلى `pnpm-workspace.yaml`، حذف `apps/mobile/pnpm-workspace.yaml` و`apps/mobile/pnpm-lock.yaml`، دمج `overrides` و`patchedDependencies` الخاصة بالجوال في الجذر، ثم `pnpm install` واحد.

**المزايا:** قفل واحد، تثبيت واحد، لا ازدواج في `packages/shared`، أبسط للصيانة وأدوات الذكاء الاصطناعي.

**المخاطر:** تغيّر شجرة الاعتمادات الأصلية؛ تعارض `hoisted` مع متطلبات Expo؛ اختلاف إصدارات React/React Native؛ رقع Metro وexpo-router؛ بناء iOS قد ينكسر. يحتاج بناء TestFlight قبل القبول.

### الخيار ب — إبقاء الجوال مستقلًا مع عقد مبني (أقل مخاطرة على البناء)

**كيف:** إبقاء `apps/mobile` خارج workspace الجذر، وإزالة `../../packages/shared` من workspace الجوال، واستهلاك `@sawaa/shared` و`@sawaa/api-client` كحزم مبنية/معلبة بمخرجات `dist`، مع خطوة بناء تسبق تثبيت الجوال.

**المزايا:** لا يلمس شجرة بناء iOS الحالية؛ أقل خطرًا على TestFlight.

**المخاطر:** يخالف عنوان البند «workspace واحد»؛ يضيف خطوة بناء وتغليف؛ `api-client` يعتمد على `shared` بـ`workspace:*` فيحتاج تغيير آلية النشر أو تغليف الحزمة؛ قد يخفي الانحراف بدل أن يمنعه.

**التوصية:** الخيار أ إذا أثبت بناء TestFlight أن الاعتمادات متوافقة؛ وإلا الخيار ب مع توثيق أنه استثناء دائم، لا حل مؤقت. لا تُختار (ب) لمجرد تجنب التجربة.

## المخاطر

- **كسر بناء iOS** — الأثر: تعطّل النشر للمتجر. التخفيف: فرع مستقل، بناء TestFlight إلزامي، وعدم الدمج قبل تثبيت يدوي.
- **اختلاف `nodeLinker`** — الأثر: حزم غير مرئية أو نسخ مزدوجة من React. التخفيف: `pnpm why react` و`pnpm why react-native` قبل وبعد، وقفل الإصدارات المباشرة.
- **`overrides` و`patches`** — الأثر: فقدان رقعة أمنية أو كسر Metro. التخفيف: نقل 18 override و5 رقع إلى الجذر مع الحفاظ على الإصدارات، ومراجعة `docs/operations/dependency-overrides.md`.
- **`postinstall`** — الأثر: استدعاء بناء `shared` من داخل تثبيت الجوال أو تكراره. التخفيف: إزالة `postinstall` إذا صار الجوال عضوًا في الجذر، وبناء `shared` خطوة صريحة في CI.
- **`api-client` يشير إلى `src`** — الأثر: لا يعمل كحزمة مستقلة للجوال. التخفيف: قرار ADR: إما بناء `dist` مع `exports` صحيحة، أو قبول استهلاك المصدر عبر Metro مع مسار TypeScript صريح.
- **تعديل `.github/**`** — الأثر: منطقة مالك. التخفيف: يبقى التعديل لصاحب القرار، والمنفذ يجهّز الفرق فقط.
- **TestFlight لا يعمل من فرع غير `develop`/`main`** — الأثر: لا يمكن تحقيق معيار القبول قبل الدمج، أو يُضطر الفريق لتعديل مؤقت في workflow. التخفيف: قرار مالك مسبق بين الخيار 1 (تعديل مؤقت محدود) والخيار 2 (إرجاء الإثبات)، وتوثيق القرار في الـPR.
- **مسار إصدار iOS يشغّل تثبيتين** — الأثر: بعد توحيد workspace تصبح `pnpm --dir apps/mobile install --frozen-lockfile` خطوة خاطئة أو مكررة. التخفيف: تعديل `scripts/apple-release/build-ios.sh` ضمن نفس الـPR، وعدم الدمج قبل بناء ناجح.
- **62 ملفًا يستورد أنواع الجوال المحلية** — الأثر: حذف تعريفات يكسر typecheck واسع. التخفيف: ترحيل تدريجي، وإبقاء `types/models.ts` كواجهة إعادة تصدير مؤقتة، وحذف التعريفات الداخلية فقط بعد نجاح typecheck.
- **`BookingStatus` قيمها 10** — الأثر: أي فرق في القيم يغيّر عرض الحالة. التخفيف: اختبار `booking.test.ts` في api-client هو الحارس، ويُضاف اختبار تكافؤ في الجوال.

## كيفية التشغيل والتحقق

```bash
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0=false

git worktree add .worktrees/mnt21 -b codex/mnt-21-mobile-contract origin/integration/maintainability
cd .worktrees/mnt21
pnpm install --frozen-lockfile --ignore-scripts
```

```bash
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile lint
pnpm --dir apps/mobile test
```

```bash
pnpm --filter @sawaa/api-client test
pnpm --filter @sawaa/shared test
pnpm --filter dashboard typecheck
```

بعد توحيد التثبيت:

```bash
pnpm install --frozen-lockfile
pnpm why react
pnpm why react-native
pnpm why zod
```

بناء TestFlight (عبر المسار المعتمد):

```bash
gh workflow list --repo tariiq222/sawaa
```

> **حاجز موثق:** `.github/workflows/apple-testflight.yml` يعمل عند `push` إلى `develop` أو`main` فقط، ووظيفة `release` مشروطة بـ`if: github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/main'`. لذلك `workflow_dispatch` من فرع `codex/*` أو `integration/*` **لن ينفّذ البناء**. لا يمكن إثبات قبول TestFlight قبل الوصول إلى `develop` إلا بأحد خيارين يحتاج كلاهما موافقة المالك:
> 1. تعديل مؤقت ومحدود في `.github/workflows/apple-testflight.yml` يسمح بفرع اختبار محدد، ثم إزالته قبل الدمج.
> 2. إرجاء إثبات TestFlight إلى أول بناء بعد دمج الخطة في `develop`، وتوثيق أنه لم يُختبر قبل الدمج.
>
> الخيار 1 هو الوحيد الذي يحقق معيار القبول «بناء TestFlight ناجح» **قبل** الدمج. لا تدّعِ نجاحه بغيره.

## القرارات

- **ADR قبل التنفيذ** — البديل المرفوض: تجربة مباشرة على `integration`. السبب: التغيير يمس بناء المتجر، ويجب أن يكون القرار مرئيًا.
- **الخيار أ هو الافتراضي** — البديل المرفوض: إبقاء workspaceين إلى الأبد. السبب: يخالف هدف البند ويُبقي ازدواج `packages/shared/node_modules`.
- **`api-client` هو مصدر `BookingStatus`** — البديل المرفوض: إنشاء تعريف جديد في `shared`. السبب: `api-client` يشتق النوع من OpenAPI ولديه اختبار انحراف قائم.
- **عدم خلط axios مع `api-client` الآن** — البديل المرفوض: إعادة كتابة كل الخدمات في نفس الـPR. السبب: يضخم المخاطر بلا علاقة مباشرة بالقبول.
- **عدم حذف تعريفات الجوال دفعة واحدة** — البديل المرفوض: حذف `apps/mobile/types` كاملًا. السبب: 62 ملفًا يعتمد عليها؛ الترحيل يجب أن يكون قابلًا للتحقق خطوة بخطوة.

## جهات الاتصال ومسارات الملفات

- **مالك القرار:** طارق الوليدي — مسار البناء والنشر للمتجر، وأي تعديل على `.github/**` أو `AGENTS.md`.
- **المنفذ:** DeepSeek — بتوجيه ومراجعة من الوكيل الرئيسي.
- **الخطة:** `docs/plans/maintainability-roadmap.md`
- **workspace الجذر:** `pnpm-workspace.yaml` و`.npmrc` و`package.json`
- **workspace الجوال:** `apps/mobile/pnpm-workspace.yaml` و`apps/mobile/pnpm-lock.yaml`
- **عقد الأنواع:** `packages/api-client/src/types/booking.ts` و`packages/api-client/src/types/booking.test.ts`
- **أنواع الجوال:** `apps/mobile/types/booking-enums.ts` و`apps/mobile/types/models.ts`
- **الاستيرادات النسبية:** `apps/mobile/services/client/bookings.ts` و`apps/mobile/services/client/booking-cancellation.ts`
- **بناء iOS:** `.github/workflows/apple-testflight.yml` و`scripts/apple-release/build-ios.sh`
- **البوابة:** `.github/workflows/merge-gate.yml`
