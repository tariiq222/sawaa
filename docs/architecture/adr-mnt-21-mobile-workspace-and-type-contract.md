# ADR — workspace الجوال وعقد الأنواع (MNT-21)

| الحقل | القيمة |
|---|---|
| المعرّف | MNT-21.1 |
| العنوان | ضمّ `apps/mobile` إلى workspace الجذر، أو إبقاؤه مستقلًا مع حزم مبنية |
| الحالة | **مقترح — ينتظر قرار المالك** (لا يُنفَّذ شيء قبل الاعتماد) |
| التاريخ | 2026-11-19 |
| الفرع المرجعي | `integration/maintainability` عند `ebdddce4e5f261f4f598a10ab710661a6bb46073` |
| مالك القرار | طارق الوليدي — مسار بناء المتجر و`.github/**` |
| المنفّذ | DeepSeek (وثيقة فقط) |
| الأثر | `workspace` الجذر، تثبيت الاعتماديات، بناء iOS/TestFlight، مصدر `BookingStatus` |

## ملخص القرار المقترح

**يُوصى بالخيار (أ): ضمّ `apps/mobile` إلى workspace الجذر** — باعتباره الهدف الصحيح طويل الأمد — **مشروطًا ببوابة قبول قابلة للقياس** (القسم «شرط القبول»).

إن فشلت البوابة، يُعتمد **الخيار (ب)** كاستثناء دائم موثّق، لا كحل مؤقت.

**لا يُنفَّذ أي خيار قبل اعتماد المالك.** هذه الوثيقة لا تغيّر workspace ولا lockfile ولا `package.json` ولا `.github/**` ولا `apps/mobile/**` ولا baseline.

## السياق

بند MNT-21 له هدفان مختلفان في الطبيعة، ويجب فصلهما لأنهما ليسا بنفس درجة الخطر:

1. **توحيد عملية التثبيت** — اليوم `packages/shared` عضو في workspaceين بقفلين و`nodeLinker` مختلفين؛ كل تثبيت قد يكتب في `packages/shared/node_modules`، والنتيجة تعتمد على ترتيب التشغيل. هذا خطر بنيوي على الحزم المشتركة.
2. **توحيد عقد الأنواع** — `BookingStatus` معرَّف أربع مرات، والجوال يستورد ملفين من `packages/api-client/src` بمسار نسبي هش.

الهدف (1) يمس شجرة اعتماديات React Native وبناء المتجر. الهدف (2) لا يمسها تقريبًا. لذلك تُرحَّل (2) بغض النظر عن نتيجة (1)، ويمكن إنجاز جزء كبير منها قبل الخيار نفسه.

## الحقائق المقاسة (تحقق مباشر على SHA أعلاه)

| # | الحقيقة | الدليل |
|---|---|---|
| F-01 | `apps/mobile` **ليس** عضوًا في workspace الجذر | `pnpm-workspace.yaml`: `apps/backend`, `apps/dashboard`, `apps/website`, `packages/shared`, `packages/api-client`, `packages/ui`, `packages/*` |
| F-02 | workspace الجوال مستقل: `.` + `../../packages/shared` | `apps/mobile/pnpm-workspace.yaml` |
| F-03 | `nodeLinker` متعارض | الجوال `isolated` (في workspace الجوال)؛ الجذر `node-linker=hoisted` (`.npmrc`) |
| F-04 | الجذر يفرض `legacy-peer-deps=true` والجوال **لا يملك `.npmrc`** | `.npmrc`؛ لا وجود لـ`apps/mobile/.npmrc` |
| F-05 | قفلان: الجذر 769,033 بايت، الجوال 478,731 بايت | `ls -l` |
| F-06 | قفل الجذر **لا يحتوي** أي مُدخل `apps/mobile`، ولا أي `expo@55` أو `react-native@0.83` | `grep` على `pnpm-lock.yaml` = 0 مطابقة |
| F-07 | `postinstall` في الجوال يبني حزمة مشتركة | `apps/mobile/package.json:6` → `pnpm --filter @sawaa/shared build` |
| F-08 | 54 override و3 رقع في الجذر | `package.json` (braces, decode-uri-component, stream-json) |
| F-09 | 18 override و5 رقع في الجوال | `apps/mobile/package.json` (metro, expo-router, decode-uri-component, braces, react-native-moyasar-sdk) |
| F-10 | رقعتان متطابقتان بايتًا ببايت | `cmp` بين `patches/braces@3.0.3.patch` و`apps/mobile/patches/braces@3.0.3.patch` (وكذلك decode-uri-component) |
| F-11 | **تعارض إصدارات React** | الجذر: override `react = 19.2.4`؛ الجوال: تبعية مباشرة `react = 19.2.0` و`react-test-renderer = 19.2.0`؛ قفل الجوال يحل `react@19.2.0`، وقفل الجذر يحل `19.2.4` و`19.3.0` |
| F-12 | **تعارض `minimatch`** | الجذر: `minimatch: ^10` مصنّف في `dependency-overrides.md` كـ«مثبّت — لا يُرفَع» لأن 11 يكسر ESLint 9؛ الجوال: `minimatch@>=10.0.0 <11.0.1: 11.0.9` |
| F-13 | **تعارض `@grpc/grpc-js`** | الجذر `>=1.14.5`؛ الجوال `1.14.5` |
| F-14 | Jest في الجوال يعتمد تخطيط `.pnpm` حرفيًا | `apps/mobile/package.json:47-48` → `<rootDir>/node_modules/.pnpm/node_modules/{immer,uuid}` |
| F-15 | اختبار توافق Metro يقرأ `.pnpm` | `apps/mobile/__tests__/metro-image-size-compat.test.js` |
| F-16 | اختبار انحدار أمني يُحلّ اعتماديات الجوال من `apps/mobile/package.json` | `scripts/security/dependency-fixes.test.cjs` (عبر `createRequire`) |
| F-17 | `@sawaa/api-client` غير موجود في اعتماديات الجوال | `apps/mobile/package.json` لا يضمه؛ يضم `@sawaa/shared: workspace:*` فقط |
| F-18 | `api-client` يشير إلى المصدر لا إلى `dist` | `main`/`types` = `./src/index.ts` |
| F-19 | **`exports` الفرعية تشير إلى ملفات غير موجودة على القرص** | `"./auth": "./src/modules/auth.js"` و`"./types": "./src/types/index.js"`؛ الملفان `.js` غير موجودين. بعض المُحلِّلات تُسقط الامتداد وتنجح، وأخرى لا — أي أن العقد غير موثوق ويجب تصحيحه قبل الاعتماد عليه |
| F-20 | `api-client` يعتمد `@sawaa/shared` بـ`workspace:*` ويُعيد تصدير أنواعه | `packages/api-client/package.json`؛ `src/types/session-package.ts` |
| F-21 | `BookingStatus` معرَّف 4 مرات، والقيم الـ10 **متطابقة** في الأربعة | Prisma (10)، api-client (10 مشتقة من OpenAPI + tuple)، اللوحة (10)، الجوال (10) — تحقق برمجي: المجموعات متساوية |
| F-22 | انحراف توثيقي فعلي في الجوال | تعليق `apps/mobile/types/booking-enums.ts` يسرد 9 قيم ولا يذكر `DEPOSIT_PAID`، بينما الـUnion يضمها — دليل على أن التعريف اليدوي ينحرف حتى حين تكون القيم صحيحة |
| F-23 | 62 ملفًا يستورد أنواع الجوال المحلية (72 موضع استيراد) | `models` 23، `booking-enums` 20، `auth` 20، `api` 5، `chat` 1 — منها 48 ملفًا غير اختباري |
| F-24 | **الاستيرادات ليست كلها نوعية**: 18 ملفًا تستورد قيمًا زمنية | من `booking-enums` 8 ملفات (`resolveDeliveryType`, `hasZoomMeetingAccess`, `resolveBookingType`, `resolveDeliveryTypeFromLegacyResponse`)؛ ومن `auth` 10 ملفات (`getPrimaryRole`, `splitName`). لا يمكن تحويلها إلى `import type` ولا إلى نوع من `api-client` |
| F-25 | استيرادان نسبيان فقط إلى `api-client/src` | `services/client/bookings.ts:2-3`، `services/client/booking-cancellation.ts:2` |
| F-26 | **`DeliveryType` غير متكافئ بين الحزمتين** | api-client: `Schemas['DeliveryType']` = `IN_PERSON \| ONLINE` (علوي، للطلب)؛ الجوال: `in_person \| online` (سفلي، مستخدم في 9 ملفات)؛ صف القراءة في OpenAPI علوي المفتاح وسفلي القيمة |
| F-27 | `Booking` في الجوال ليس نفس شكل `api-client` | يحتوي `amount`, `vatAmount`, `zoomLink`, `type: LegacyBookingType` — لا نظير لها في `BookingListItem` |
| F-28 | بناء iOS يشغّل **تثبيتين** | `scripts/apple-release/build-ios.sh:58-60` |
| F-29 | مسار `gate/mobile` يشغّل تثبيتين | `.github/workflows/merge-gate.yml` — خطوة `pnpm install --frozen-lockfile` على الجذر، ثم خطوة أخرى بـ`working-directory: apps/mobile`. مجموع أوامر `pnpm install --frozen-lockfile` في الملف 7، منها هذا الواحد داخل `apps/mobile` |
| F-30 | TestFlight محجوب بثلاث طبقات (انظر القسم المخصص) | `apple-testflight.yml:29`، `target.mjs:4`، `deployment.mjs` |
| F-31 | بعد الضم، تغييرات اعتماديات الجوال ستُشغّل بناء صور الخادم | `build-images.yml` يستخدم `paths-ignore` تشمل `apps/mobile/**` فقط، **ولا** تشمل `pnpm-lock.yaml` ولا `.npmrc` ولا `pnpm-workspace.yaml` |

### ملاحظة على F-21/F-26

تطابق القيم اليوم **لا يعني** عقدًا موحدًا: هو نتيجة صيانة يدوية متزامنة. الحارس الحقيقي الوحيد الموجود هو `packages/api-client/src/types/booking.test.ts` (مقارنة `BOOKING_STATUSES` بلقطة OpenAPI). لا يوجد حارس في الجوال يقارن تعريفه باللقطة.

## الخيار (أ) — ضمّ الجوال إلى workspace الجذر

**كيف:** إضافة `apps/mobile` إلى `pnpm-workspace.yaml`، حذف `apps/mobile/pnpm-workspace.yaml` و`apps/mobile/pnpm-lock.yaml`، دمج `overrides` (54+18) و`patchedDependencies` (3+5، مع إزالة المكرر المتطابق) في الجذر، نقل 3 رقع خاصة بالجوال إلى `patches/`، حذف `postinstall`، ثم `pnpm install` واحد.

**المزايا:**

- قفل واحد وتثبيت واحد؛ لا ازدواج في `packages/shared/node_modules`.
- `apps/mobile` يستطيع استيراد `@sawaa/api-client` كعضو workspace بلا مسار نسبي ولا خطوة تغليف.
- إزالة خطوة تثبيت ثانية من `build-ios.sh` ومن `gate/mobile`.
- أبسط لأدوات الذكاء الاصطناعي ولأي قادم جديد.

**المخاطر (كلها مسنودة بدليل):**

| الخطر | الدليل | الأثر |
|---|---|---|
| تغيير `nodeLinker` من `isolated` إلى `hoisted` | F-03 | يكسر `moduleNameMapper` (F-14) واختبار Metro (F-15)، ويغيّر دقة حل الحزم |
| `legacy-peer-deps=true` يصبح حاكمًا لتثبيت الجوال | F-04 | يخفّف فحص peer لشجرة React Native؛ لم يُقس |
| تعارض React 19.2.0 مقابل 19.2.4 | F-11 | إما ترقية الجوال أو استثناء override؛ كلاهما يحتاج قياسًا على iOS |
| تعارض `minimatch` المثبّت أمنيًا | F-12 | لا يمكن إرضاء الطرفين بقيمة واحدة؛ القرار للمالك |
| دمج 72 override و8 رقع | F-08/F-09 | خطر كسر صامت موثّق سابقًا في `dependency-overrides.md` (MNT-27) |
| قفل الجذر سينمو بآلاف المُدخلات | F-06 | زمن تثبيت وتعارضات merge؛ لم يُقس |
| بناء iOS لم يُختبر بعد الضم | F-28 | خطر تعطيل النشر للمتجر |
| بناء صور الخادم سيُشغَّل عند تغيير اعتماديات الجوال | F-31 | كلفة/ضجيج نشر غير مقصود |

**الرجوع:** الخيار قابل للرجوع بالكامل لأن التغيير كله في ملفات workspace/lock/package؛ إعادة `apps/mobile/pnpm-workspace.yaml` و`pnpm-lock.yaml` من `git` واستعادة `postinstall` يعيد الوضع الحالي، بشرط أن يكون فرع التنفيذ منفصلًا وغير مدموج في `develop`.

## الخيار (ب) — إبقاء الجوال مستقلًا مع حزم مبنية

**كيف:** يبقى `apps/mobile` خارج workspace الجذر، ويُزال `../../packages/shared` من workspace الجوال، ويستهلك `@sawaa/shared` و`@sawaa/api-client` كحزم معلّبة (`file:` tarball أو `dist`)، مع خطوة بناء/تغليف تسبق تثبيت الجوال.

**المزايا:**

- لا يلمس شجرة اعتماديات iOS الحالية ولا `nodeLinker` ولا إصدارات React.
- أقل خطر مباشر على TestFlight اليوم.
- يمنع فعليًا أي كتابة ثانية في `packages/shared/node_modules` إن أُزيل `shared` من workspace الجوال.

**المخاطر:**

| الخطر | الدليل | الأثر |
|---|---|---|
| لا يحقق عنوان البند «workspace واحد» | — | يبقى قفلان وعمليتا تثبيت (وإن كان إحداهما لا يرى `shared`) |
| `api-client` غير قابل للاستهلاك كحزمة | F-18/F-19/F-20 | يحتاج إضافة `build`/`files`/`exports` صحيحة، وتضمين أو مرافقة `shared` كتبعية معلّبة داخلية |
| تضاعف نسخ `shared` المعلّبة | F-20 | احتمال نسختين بفروق إصدار بين الجوال و`api-client` |
| خطوة تغليف في 3 مواضع | F-28/F-29 | `build-ios.sh` و`gate/mobile` وأي تشغيل محلي: خطوة إضافية قابلة للنسيان |
| يخفي الانحراف بدل منعه | — | الحزمة المبنية قد تتأخر عن المصدر دون فشل واضح |

**الرجوع:** أسهل من (أ) لأن الفرع لا يمس `pnpm-workspace.yaml` الجذري ولا شجرة iOS؛ لكن يجب حذف الحزم المعلّبة والرجوع لخطوة البناء اليدوية.

## المقارنة الصريحة

| البُعد | (أ) ضمّ الجذر | (ب) مستقل بحزم مبنية |
|---|---|---|
| عملية تثبيت واحدة | ✅ نعم | ⚠️ لا (لا يكتب في `shared`، لكن يبقى تثبيت مستقل) |
| Expo / Metro | ⚠️ يتغير `nodeLinker`؛ يلزم إصلاح F-14/F-15 وقياس `expo prebuild` | ✅ بلا تغيير (إن بقيت الشجرة كما هي) |
| React Native / React | ⚠️ تعارض F-11 يجب حلّه وتثبيته | ✅ بلا تغيير |
| الرقع | ⚠️ دمج 8 رقع (منها 2 متطابقتان) | ✅ لا تلمس رقع الجوال |
| overrides | ⚠️ دمج 72 مع تعارضات مؤكدة F-12/F-13 | ✅ لا تلمس overrides الجوال |
| بناء TestFlight | ⚠️ يتغير المسار (تثبيت واحد) ويحتاج إثباتًا كاملًا | ✅ المسار الحالي كما هو |
| استهلاك `api-client` | ✅ مباشر | ⚠️ يحتاج تغليفًا وإصلاح `exports` |
| الرجوع | متوسط (فرع منفصل + استعادة ملفات) | سهل |
| أثر على صور الخادم | ⚠️ F-31 | ✅ لا أثر |
| الصيانة طويلة الأمد | ✅ الأفضل | ⚠️ استثناء دائم يجب توثيقه وحراسته |

## شرط القبول القابل للقياس

الخيار (أ) يُعتمد فقط إذا تحققت **كل** البنود التالية على فرع تنفيذ معزول:

1. **AC-1 — تثبيت واحد فعليًا**
   - `apps/mobile/pnpm-workspace.yaml` و`apps/mobile/pnpm-lock.yaml` غير موجودين.
   - لا يوجد أي أمر `pnpm --dir apps/mobile install` في `.github/workflows/merge-gate.yml` ولا في `scripts/apple-release/build-ios.sh`.
   - **إثبات الكتابة الواحدة:** تُؤخذ بصمة مرتبة لملفات `packages/shared/node_modules` (`find … -type f | sort | xargs shasum`) قبل `pnpm install --frozen-lockfile` من الجذر وبعده؛ ثم يُعاد التثبيت ثانيةً ويجب أن تبقى البصمة **متطابقة** (idempotent) — أي لا كاتب ثانٍ.
2. **AC-2 — مصدر واحد للـenums**
   - `rg -n "export type BookingStatus" apps/mobile` → **صفر** تعريف محلي.
   - `rg -n "export type BookingStatus" packages/api-client/src` → مطابقة واحدة (المصدر الوحيد).
   - الجوال يحتوي فقط `export type { BookingStatus } from '@sawaa/api-client'`.
   - اللوحة: تعريفها إما مشتق من اللقطة أو استثناء موثّق في م4 (لا يُترك صامتًا).
3. **AC-3 — تكافؤ القيم**
   - `pnpm --filter @sawaa/api-client test -- src/types/booking.test.ts` ناجح.
   - اختبار جوال يقارن تعداد مفاتيح `STATUS_LABEL_MAP` بقيم `BOOKING_STATUSES` (يفشل عند إضافة/حذف قيمة).
4. **AC-4 — إصدارات مفردة**
   - `pnpm why react`، `pnpm why react-dom`، `pnpm why react-native`، `pnpm why @types/react`، `pnpm why zod` كل واحد منها يعرض نسخة واحدة.
   - أي استثناء متبقٍّ يُوثَّق بسبب صريح في `docs/operations/dependency-overrides.md` وفي PR.
5. **AC-5 — البوابات**
   - `pnpm --dir apps/mobile typecheck` ✅، `lint` ✅، `test` ✅ (بعتبات التغطية).
   - `pnpm --filter dashboard typecheck` ✅، `pnpm --filter @sawaa/api-client test` ✅.
   - `SAWAA_INCLUDE_MOBILE_DEPENDENCIES=1 node --test scripts/security/dependency-fixes.test.cjs scripts/security/refresh-dependency-fixes.test.cjs` ✅.
   - `apps/mobile/__tests__/metro-image-size-compat.test.js` ✅ بعد إزالة افتراض `.pnpm`.
6. **AC-6 — إثبات بناء iOS**
   - إثبات توافق الاعتماديات على المرشح (انظر «حاجز TestFlight»)، **و**بناء TestFlight موقّع ناجح، **و**تثبيت الـIPA على جهاز واحد على الأقل، **و**`SawaaSourceSha` داخل الحزمة يساوي SHA المرشح.
7. **AC-7 — إزالة المسارات النسبية**
   - `rg -n "packages/api-client/src" apps/mobile` → صفر.

> **قاعدة الحسم:** إن فشل أي بند من AC-1..AC-5 أو AC-6 على المرشح بعد محاولتين موثقتين، يُعتمد الخيار (ب) كاستثناء دائم ويُوثَّق سبب الرفض في نفس ملف الـADR. لا يُختار (ب) قبل المحاولة، ولا تُخفَّض البوابة لتنجح (أ).

## خطة الترحيل — `BookingStatus` والاستيرادات الـ62

الاستيرادات الـ62 ليست 62 عقدًا متطابقًا (F-27)؛ لذلك الترحيل **طبقي** لا جماعي، ويُبقي إعادة تصدير مؤقتة.

### المبدأ: إعادة تصدير مؤقتة

`apps/mobile/types/models.ts` يُعيد تصدير الـenums من `booking-enums.ts`، وهو بذاته نقطة قطع طبيعية. لذلك:

1. يُعدَّل **ملف واحد** (`booking-enums.ts`) ليصبح واجهة إعادة تصدير، فتُورَّث الأنواع لكل مستهلكي `models.ts` (23 ملفًا) دفعة واحدة.
2. تبقى الدوال الزمنية (`resolveDeliveryType`, `hasZoomMeetingAccess`, `resolveBookingType`, `resolveDeliveryTypeFromLegacyResponse`) في الملف كما هي — لأنها منطق لا أنواع.
3. لا يُحذف `booking-enums.ts` نفسه في هذه المرحلة؛ يُحذف فقط تعريف الـUnion المحلي.

```ts
// apps/mobile/types/booking-enums.ts (الهيكل المستهدف)
export type { BookingStatus } from '@sawaa/api-client'
export { BOOKING_STATUSES } from '@sawaa/api-client'

// يبقى محليًا لأن api-client يصدّر DeliveryType/BookingType بخطاب علوي لحمولة الطلب (F-26)
export type BookingType = 'individual' | 'walk_in' | 'group'
export type DeliveryType = 'in_person' | 'online'
```

### المراحل

| المرحلة | العمل | البوابة | الرجوع |
|---|---|---|---|
| م0 | إصلاح `exports` في `packages/api-client` (F-19): توجيه `./types` و`./auth` إلى ملفات موجودة (`./src/types/index.ts`, `./src/modules/auth.ts`)؛ وقرار كيف يُستهلك `api-client` في Metro (مصدر أو `dist`) | `pnpm --filter @sawaa/api-client typecheck` + `test` | revert ملف واحد |
| م1 | تحويل `booking-enums.ts` إلى إعادة تصدير للأنواع + إبقاء الدوال الزمنية الثمانية المستهلكة؛ إضافة اختبار تكافؤ | `pnpm --dir apps/mobile typecheck` + `test` (20 ملفًا يعتمد الملف، منها 8 تستورد قيمًا) | revert ملف واحد — يعيد الـUnion المحلي فورًا |
| م2 | ترحيل استيرادات `@/types/booking-enums` إلى المصدر الجديد على دفعات: (أ) `services/client`، (ب) `features/booking`، (ج) `app/**`، (د) `components|hooks|lib`، (هـ) الاختبارات | `typecheck` بعد كل دفعة | كل دفعة commit مستقل |
| م3 | تحويل الاستيرادين النسبيين (F-25) إلى استيراد رسمي؛ إضافة حارس `rg` في CI أو سكربت فحص | AC-7 | revert |
| م4 | قرار اللوحة (21.5): اشتقاق `BookingStatus` في `apps/dashboard/lib/types/booking.ts` من لقطة OpenAPI (كما يفعل api-client) وإضافة اختبار تكافؤ — أو توثيق الاستثناء | `pnpm --filter dashboard typecheck` + اختبار | revert |
| م5 | بقية العقود (`models`/`auth`/`chat`/`api`): **لا تُرحَّل جماعيًا**. تُصنَّف إلى (i) ما لـ`api-client` نظير متوافق → يُرحَّل عند لمس الملف؛ (ii) ما لا نظير له (مثل `Booking` الجوال F-27) → يبقى محليًا مع اختبار تكافؤ للحقول المشتركة | بعد كل ملف | ملف بملف |
| م6 | حذف التعريفات المكررة النهائية وإبقاء الحراس | AC-2 + AC-3 | revert |

**ملاحظة نطاق مقترحة:** صياغة البند «الجوال يستورد الأنواع من `@sawaa/api-client`» يجب أن تُقرأ عمليًا كـ: **الـenums والأنواع ذات النظير المتوافق** من `api-client`، لا كل الأنواع — لأن `Booking` الجوال عقد مختلف عمدًا (F-27). أي محاولة لفرض الاشتقاق الكامل ستكون إعادة كتابة، لا توحيدًا.

## حاجز TestFlight (مؤكد بالدليل)

**لا يمكن اليوم بناء TestFlight من `codex/*` أو `integration/*`.** الحاجز ثلاثي:

1. **حارس المهمة:** `.github/workflows/apple-testflight.yml:29` → `if: github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/main'`. لذلك `workflow_dispatch` من فرع آخر يُنشئ تشغيلًا بمهمة متخطاة، ولا ينتج IPA.
2. **حارس الهدف:** `scripts/apple-release/target.mjs:4` يرفع `Unsupported release branch` لأي فرع غير `develop`/`main`.
3. **حارس المطابقة مع النشر:** `scripts/apple-release/deployment.mjs` يشترط وجود نشر OpenShip بحالة `ready` ومصدره يساوي `GITHUB_SHA`، و`assertCurrentSource` يشترط أن رأس الفرع يساوي نفس SHA. SHA غير مدموج لا يحقق ذلك. لذلك **إزالة الحارس (1) وحدها لا تكفي**.

### الخيارات (كلها تحتاج موافقة مالك، ولم يُنفَّذ أي منها)

| # | الخيار | يحقق ماذا | المخاطر/القيود |
|---|---|---|---|
| ت1 | **إثبات توافق بلا توقيع**: تشغيل محدود ومؤقت بموافقة المالك يشغّل تثبيتًا واحدًا + `expo prebuild` + `pod install` + `xcodebuild build` (بلا `archive`/`export`/رفع) على فرع المرشح | يثبت أن شجرة الاعتماديات الجديدة تُثبَّت وتبني وتربط على iOS — وهو الخطر الفعلي للخيار (أ) | لا يثبت التوقيع ولا الرفع؛ يحتاج تعديلًا مؤقتًا في `.github/**` و`scripts/apple-release/**` مع إزالة قبل الدمج |
| ت2 | **بناء موقّع بلا رفع**: مثل ت1 لكن يصل إلى أرشيف IPA مع `APPLE_ALLOW_UPLOAD` غير مضبوط، وتنزيل الـIPA كـartifact للتثبيت اليدوي | يحقق تثبيتًا على جهاز قبل الدمج | يمنح فرعًا غير محمي وصولًا لأسرار توقيع Apple وASC — خطر أمني يجب أن يعتمده المالك صراحةً؛ ويجب أن يكون التشغيل محصورًا بفرع واحد بالاسم وأن يُزال التعديل قبل الدمج |
| ت3 | **إرجاء الإثبات إلى `develop`**: الدمج أولًا ثم أول بناء TestFlight (المسار الطبيعي) | لا يمس `.github/**` ولا الأسرار | لا يحقق معيار القبول قبل الدمج؛ يجب تسجيل صريح في PR بأن قبول TestFlight معلّق حتى أول بناء على `develop` (البند 21.7.1) |

**توصية:** ت1 لإثبات توافق الاعتماديات قبل الدمج (بلا أسرار وبلا رفع)، ثم بناء TestFlight الموقّع على `develop` كبوابة إصدار. إن رفض المالك أي تعديل في `.github/**`، يُعتمد ت3 مع تسجيل الفجوة.

**لا تدّعِ أي شيء من هذه الخيارات ناجحًا الآن** — لم تُشغَّل.

## الملفات المتأثرة (للتنفيذ اللاحق، لا لهذا الـADR)

**الخيار (أ):**
- `pnpm-workspace.yaml` (إضافة `apps/mobile`)
- `apps/mobile/pnpm-workspace.yaml` — حذف
- `apps/mobile/pnpm-lock.yaml` — حذف
- `apps/mobile/package.json` — حذف `postinstall`، نقل `overrides`/`patchedDependencies`، إضافة `@sawaa/api-client`
- `package.json` الجذري — دمج `overrides` و`patchedDependencies` و`onlyBuiltDependencies`، وحسم `react`
- `patches/metro@0.83.7.patch`, `patches/expo-router@55.0.18.patch`, `patches/react-native-moyasar-sdk@0.15.0.patch` (منقولة)، وحذف المكرر من `apps/mobile/patches/`
- `pnpm-lock.yaml` (مُعاد توليده)
- `apps/mobile/package.json` (`jest.moduleNameMapper`) و`apps/mobile/__tests__/metro-image-size-compat.test.js` — إزالة افتراض `.pnpm`
- `apps/mobile/metro.config.js` — تحديث التعليق و/أو resolver
- `.github/workflows/merge-gate.yml` و`scripts/apple-release/build-ios.sh` — إزالة التثبيت الثاني (**منطقة مالك**)
- `docs/operations/dependency-overrides.md` — تسجيل الدمج (إلزامي بحسب MNT-26)
- `AGENTS.md` / `apps/mobile/CLAUDE.md` — تحديث أوامر التشغيل (**منطقة مالك**)

**الخيار (ب):**
- `apps/mobile/pnpm-workspace.yaml` (إزالة `../../packages/shared`) و`apps/mobile/package.json` (تبعيات `file:`)
- `packages/api-client/package.json` (build/files/exports)
- `packages/api-client` مصدر تغليف + خطوة بناء في `build-ios.sh` و`gate/mobile`
- `apps/mobile/metro.config.js` (إزالة `extraNodeModules` لـ`shared`)

**مشترك (بغض النظر عن الخيار):**
- `apps/mobile/types/booking-enums.ts` (إعادة تصدير)
- `apps/mobile/types/__tests__/booking-enums.test.ts` (اختبار تكافؤ)
- `apps/mobile/services/client/bookings.ts`, `apps/mobile/services/client/booking-cancellation.ts`
- `packages/api-client/package.json` (إصلاح `exports`)

## أوامر التحقق (لم تُشغَّل في هذه الجلسة)

```bash
# تثبيت واحد + إثبات عدم وجود كاتب ثانٍ
pnpm install --frozen-lockfile
pnpm why react
pnpm why react-dom
pnpm why react-native
pnpm why @types/react
pnpm why zod

# بوابات الجوال والحزم
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile lint
pnpm --dir apps/mobile test
pnpm --filter @sawaa/api-client test -- src/types/booking.test.ts
pnpm --filter @sawaa/api-client typecheck
pnpm --filter dashboard typecheck

# حراس
node scripts/check-api-client-drift.mjs
SAWAA_INCLUDE_MOBILE_DEPENDENCIES=1 node --test scripts/security/dependency-fixes.test.cjs scripts/security/refresh-dependency-fixes.test.cjs
rg -n "export type BookingStatus" apps/mobile packages/api-client/src
rg -n "packages/api-client/src" apps/mobile

# iOS (المسار المعتمد فقط)
bash scripts/apple-release/build-ios.sh   # يتطلب متغيرات البيئة وأسرار التوقيع
```

> **تحذير:** `bash scripts/apple-release/build-ios.sh` يحتاج `GITHUB_SHA` و`GITHUB_REF_NAME` وأسرار توقيع؛ لا يُشغَّل محليًا بأسرار إنتاج، ومع `GITHUB_REF_NAME` غير `develop`/`main` يفشل عند `target.mjs` (F-30/ت2).

## ما لم يُتحقق في هذه الجلسة

- لم يُشغَّل أي `pnpm install` ولا build ولا `typecheck` ولا `lint` ولا `test`.
- لم يُبنَ TestFlight ولم يُثبَّت IPA على جهاز.
- لم يُقس أثر الضم على زمن التثبيت أو حجم `node_modules` أو زمن `gate`.
- لم يُحسم تعارض `react` / `minimatch` / `@grpc/grpc-js` (F-11..F-13) — قرار مالك.
- لم يُختبر سلوك `hoisted` + `legacy-peer-deps` مع Expo/Metro على iOS.
- لا ادّعاء بأي نجاح لأي أمر أعلاه.

## المخاطر والرجوع (ملخص)

- **الخطر الأعظم:** كسر بناء المتجر. التخفيف: فرع معزول، ت1 قبل الدمج، عدم الدمج قبل تثبيت يدوي أو تسجيل فجوة ت3 صراحةً.
- **خطر صامت:** override واحد خاطئ يكسر أداة كاملة (سابقة موثقة في `dependency-overrides.md`). التخفيف: نقل التجاوزات واحدًا واحدًا مع مرجع، والتحقق من `pnpm why` لكل حزمة متأثرة.
- **خطر الغموض:** تثبيتان يكتبان في `packages/shared/node_modules`. التخفيف: AC-1 كإثبات بصمة، لا كادعاء.
- **الرجوع:** في (أ) رجوع كامل عبر استعادة ملفات workspace ولوك من `git`؛ في (ب) رجوع بإزالة الحزم المعلّبة. كلا الرجوعين ممكن لأن التنفيذ على فرع غير مدموج.

## البديل المرفوض

**إبقاء الوضع الحالي بلا قرار** (workspaceين إلى الأبد): يبقي ازدواج `packages/shared/node_modules`، ويعتمد على ترتيب تشغيل غير محكوم، ويترك `BookingStatus` بلا حارس في الجوال — وهو ما أنتج الانحراف الموثّق في F-22. هذا مرفوض لأنه يخالف هدف البند ويترك خطرًا صامتًا.

## المراجع

- `docs/plans/handoffs/MNT-21.md` — تسليم البند
- `docs/plans/maintainability-roadmap.md` — MNT-21
- `docs/operations/dependency-overrides.md` — سجل التجاوزات وتصنيفاتها
- `docs/operations/deployment-policy.md` — سياسة النشر (`.github/**` منطقة مالك)
- `docs/architecture/clinic-service-booking-contract.md` — عقد الحجز (سياق الأنواع)
- `packages/api-client/src/types/booking.ts` و`booking.test.ts`
- `apps/mobile/types/booking-enums.ts`، `apps/mobile/types/models.ts`
- `.github/workflows/apple-testflight.yml`، `scripts/apple-release/{target,build-ios,deployment}.*`
- `.github/workflows/merge-gate.yml`، `.github/workflows/build-images.yml`
