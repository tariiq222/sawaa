# تسليم MNT-18 — تفكيك الـhandlers العملاقة

**التاريخ:** 2026-11-19  
**الفرع الأساس:** `integration/maintainability` عند `ebde0b6e2`  
**الحالة:** جاهز للبدء بالترتيب الأدنى خطرًا — لم يُنفَّذ أي تفكيك بعد.

## الهدف

تقليص كل handler في القائمة إلى **300 سطر أو أقل** دون أي تغيير في:
- استعلامات Prisma أو ترتيبها،
- ترتيب عمليات المعاملة،
- `openapi.json`،
- سلوك أي مسار يستخدمه العميل.

**معيار القبول:** كل handler في القائمة ≤ 300 سطر، و`apps/backend/openapi.json` بلا فرق، و`gate` و`critical-real-e2e` و`pnpm test:premerge` ناجحة، وMoyasar sandbox موثق للمسارات المالية.

## الحالة الحالية

**غير جاهز للتنفيذ كدفعة واحدة.** 7 handlers ≥ 500 سطر بإجمالي **4,774 سطرًا** في الكود الإنتاجي، ولكل واحد ملف spec قائم. ثلاثة منها (`create-booking`، `moyasar-webhook`، `refund-payment`) محمية صراحة في `AGENTS.md` وتحتاج موافقة مالك واستعداد Moyasar sandbox.

### القياس الفعلي (2026-11-19)

| # | Handler | الأسطر | أسطر الـspec | عدد `it/test` |
|---:|---|---:|---:|---:|
| 1 | `apps/backend/src/modules/comms/chat/operations/confirm-operation.handler.ts` | 544 | 435 | 12 |
| 2 | `apps/backend/src/modules/bookings/book-from-credit/book-from-credit.handler.ts` | 661 | 1,178 | 38 |
| 3 | `apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts` | 673 | 1,461 | 85 |
| 4 | `apps/backend/src/modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler.ts` | 786 | 983 | 30 |
| 5 | `apps/backend/src/modules/finance/moyasar-payment-settlement/moyasar-payment-settlement.handler.ts` | 547 | 237 | 4 |
| 6 | `apps/backend/src/modules/finance/moyasar-webhook/moyasar-webhook.handler.ts` | 512 | 1,325 | 62 |
| 7 | `apps/backend/src/modules/finance/refund-payment/refund-payment.handler.ts` | 1,051 | 814 | 21 |
| | **الإجمالي** | **4,774** | **6,433** | **252** |

> الترقيم أعلاه هو ترتيب الخطة من الأقل خطرًا، وليس ترتيب الحجم. `confirm-operation` أولًا رغم أنه ليس الأصغر.

### ملاحظة تغطية حرجة

`moyasar-payment-settlement.handler.ts` فيه **4 اختبارات فقط** لـ547 سطرًا. قبل تفكيكه يجب إضافة اختبارات للفروع غير المغطاة، وإلا سيكون التفكيك بلا شبكة أمان. هذا شرط مسبق لا اختياري.

## ما أُنجز مع دليل

- **جرد كامل ومقاس** — `find apps/backend/src/modules -type f -name '*handler.ts' ! -name '*.spec.ts' -exec wc -l {} +` يثبت الأحجام أعلاه.
- **كل handler له spec قائم** — التحقق من `wc -l` لكل `*.handler.spec.ts`، وعدد حالات `it/test` محسوب بـ`rg -c`.
- **شبكة حماية للعقد** — بوابة `backend` في `.github/workflows/merge-gate.yml` تشغّل `openapi:build-and-snapshot` ثم `git diff --exit-code -- openapi.json`، فأي تغيير غير مقصود في العقد يفشل الدمج.
- **اختبارات حرجة حقيقية** — `pnpm --filter=backend run test:e2e:critical` يشمل 45 ملف e2e حقيقيًا على قاعدة بيانات، منها المالية والحجوزات والمصادقة.
- **الخطة الأصلية** — `docs/plans/maintainability-roadmap.md` تحدد الترتيب والقبول والتحقق.

**غير مُتحقق:** لم تُشغَّل الاختبارات السبعة كاملة في هذه الجلسة، ولم يُقس زمن أي handler. كما أن `refund-payment` و`moyasar-webhook` و`create-booking` لم تُراجَع وظيفيًا بعد.

## ما تبقى

| # | Handler | المهمة | المالك | معيار الإنجاز |
|---:|---|---|---|---|
| 18.1 | `confirm-operation` | استخراج التحقق/التحويل إلى دوال نقية في المجلد نفسه | DeepSeek | ≤ 300 سطر، 12 اختبارًا الحالية تمر، لا تغيير عقد |
| 18.2 | `book-from-credit` | استخراج اختيار الرصيد والتحقق إلى ملفات مساعدة | DeepSeek | ≤ 300 سطر، 38 اختبارًا تمر |
| 18.3 | `create-booking` | خطة تفكيك + موافقة مالك قبل أي تعديل | DeepSeek ثم المالك | موافقة مكتوبة في PR + ≤ 300 سطر + Moyasar sandbox |
| 18.4 | `init-package-purchase` | استخراج بناء اللقطة والتسعير | DeepSeek | ≤ 300 سطر، 30 اختبارًا تمر |
| 18.5 | `moyasar-payment-settlement` | إضافة اختبارات للفروع الناقصة أولًا، ثم تفكيك | DeepSeek | تغطية الفروع الأساسية + ≤ 300 سطر + sandbox |
| 18.6 | `moyasar-webhook` | موافقة مالك + تفكيك مع اختبارات التوقيع والتكرار | DeepSeek ثم المالك | ≤ 300 سطر، 62 اختبارًا تمر، sandbox |
| 18.7 | `refund-payment` | موافقة مالك + تفكيك مع اختبارات VAT والاسترجاع | DeepSeek ثم المالك | ≤ 300 سطر، 21 اختبارًا تمر، sandbox |

**قاعدة لكل handler:** يُضاف أي اختبار ناقص **قبل** التعديل، ويُثبت أن الاختبار كان يفشل أو يمر على الكود القديم، ثم يُعاد بعد التفكيك.

## المخاطر

- **`refund-payment` أكبر ملف (1,051 سطرًا) ويمس المال** — الأثر: خطأ في الاسترجاع أو VAT أو الحالات. التخفيف: موافقة مالك، اختبارات sandbox، ولا تغيير في الاستعلامات أو ترتيبها.
- **`moyasar-webhook` يمس التوقيع والتكرار** — الأثر: قبول webhook مزيف أو معالجة مزدوجة. التخفيف: اختبارات `moyasar-webhook-idempotency` و`moyasar-webhook-signature-http` إلزامية قبل وبعد.
- **`create-booking` محمي في `AGENTS.md`** — الأثر: مخالفة سياسة. التخفيف: لا يبدأ إلا بموافقة مالك صريحة في الـPR.
- **نقل منطق يغيّر ترتيب الاستعلامات** — الأثر: سباق أو سلوك مختلف تحت التزامن. التخفيف: «نقل بلا إعادة كتابة»، والاستعلامات تبقى في `execute`، والدوال المستخرجة نقية.
- **تضخم الاختبارات** — الأثر: بطء البوابة. التخفيف: استخراج helpers للاختبارات بدل نسخ الإعداد، دون إضعاف التغطية.
- **تفكيك بلا اختبارات كافية** — الأثر: انحدار صامت. التخفيف: شرط التغطية المسبق، خصوصًا `moyasar-payment-settlement`.

## كيفية التشغيل والتحقق

```bash
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0=false

git worktree add .worktrees/mnt18 -b codex/mnt-18-handlers origin/integration/maintainability
cd .worktrees/mnt18
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @sawaa/shared build
```

```bash
pnpm --filter=backend test -- apps/backend/src/modules/comms/chat/operations/confirm-operation.handler.spec.ts
pnpm --filter=backend test -- apps/backend/src/modules/bookings/book-from-credit/book-from-credit.handler.spec.ts
pnpm --filter=backend test -- apps/backend/src/modules/bookings/create-booking/create-booking.handler.spec.ts
pnpm --filter=backend test -- apps/backend/src/modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler.spec.ts
pnpm --filter=backend test -- apps/backend/src/modules/finance/moyasar-payment-settlement/moyasar-payment-settlement.handler.spec.ts
pnpm --filter=backend test -- apps/backend/src/modules/finance/moyasar-webhook/moyasar-webhook.handler.spec.ts
pnpm --filter=backend test -- apps/backend/src/modules/finance/refund-payment/refund-payment.handler.spec.ts
```

```bash
pnpm --filter=backend run test:e2e:critical
pnpm openapi:sync
git diff --exit-code -- apps/backend/openapi.json
pnpm test:premerge
```

فحص الحجم بعد كل handler:

```bash
wc -l apps/backend/src/modules/**/*handler.ts
```

## القرارات

- **الترتيب من الأقل خطرًا كما في الخطة** — البديل المرفوض: البدء بالأكبر. السبب: الأكبر هو الأكثر مالية وحساسية، والبدء به يخاطر بالعميل قبل بناء الثقة في النمط.
- **دوال نقية في مجلد الشريحة** — البديل المرفوض: خدمات مشتركة جديدة. السبب: يوسّع السطح ويخلق اقترانًا جديدًا؛ المطلوب تفكيك موضعي.
- **`execute` يبقي تنسيق المعاملة** — البديل المرفوض: نقل المعاملة إلى خدمة. السبب: يغيّر حدود الاتساق والترتيب.
- **بوابة العقد شرط دمج** — البديل المرفوض: الاعتماد على مراجعة بشرية للعقد. السبب: `openapi.json` ملف ضخم، والفرق الآلي هو الدليل.

## جهات الاتصال ومسارات الملفات

- **مالك القرار:** طارق الوليدي — موافقة لكل handler مالي على حدة.
- **المنفذ:** DeepSeek — بتوجيه ومراجعة من الوكيل الرئيسي.
- **الخطة:** `docs/plans/maintainability-roadmap.md`
- **البوابة:** `.github/workflows/merge-gate.yml`
- **العقد:** `apps/backend/openapi.json`
- **المسارات الحرجة في `AGENTS.md`:** `moyasar-webhook`، `refund-payment`، `create-booking`
- **الاختبارات الحقيقية:** `apps/backend/test/e2e/finance/` و`apps/backend/test/e2e/bookings/`
