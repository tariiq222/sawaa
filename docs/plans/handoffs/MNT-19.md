# تسليم MNT-19 — باقي الدورات بين الوحدات

**التاريخ:** 2026-11-19  
**الفرع الأساس:** `integration/maintainability` عند `ebde0b6e2`  
**الحالة:** جاهز للبدء بعد قرار ADR — لم يُنفَّذ أي فصل بعد.

## الهدف

تقليل الأزواج ثنائية الاتجاه بين وحدات الخلفية إلى **زوجين أو أقل**، و`forwardRef` إلى **واحد أو أقل**، مع توثيق صريح لكل استثناء باقٍ في الـbaseline.

**معيار القبول المثبت:** سكربت `pnpm check:backend-boundaries` يطبع `bidirectional module pairs: 2` أو أقل و`forwardRef` النشط في الخلفية 1 أو أقل، وكل استثناء متبقٍ له سطر مبرر في الـbaseline أو في ADR.

## الحالة الحالية

**غير جاهز للتنفيذ المباشر.** القياس الحالي: 8 أزواج ثنائية الاتجاه، 4 `forwardRef` (3 في الخلفية + 1 في اللوحة)، و3 استيرادات طبقات معكوسة. أكبر كتلة هي `identity → people`: 19 مدخلًا في 19 ملفًا و27 موضع كتابة فعلي.

### القياس الفعلي (2026-11-19)

```text
module import edges: 36 (202 statements in 126 files)
bidirectional module pairs: 8
reverse-layer import entries: 3
cross-cluster Prisma write call sites: 135
  excluding ops-owned tables: 96
baseline-tracked entries: 250
```

### الأزواج الثنائية الثمانية

| الزوج | `A → B` (ملفات) | `B → A` (ملفات) |
|---|---:|---:|
| `bookings ↔ finance` | 17 | 7 |
| `comms ↔ identity` | 1 | 6 |
| `comms ↔ people` | 2 | 2 |
| `finance ↔ org-experience` | 6 | 9 |
| `identity ↔ people` | 1 | 7 |
| `identity ↔ platform` | 11 | 1 |
| `org-config ↔ people` | 1 | 1 |
| `bookings ↔ org-experience` | 2 | 1 |

### `forwardRef` النشط (بلا ملفات spec)

- `apps/backend/src/modules/comms/comms.module.ts:220` — `forwardRef(() => PeopleModule)`
- `apps/backend/src/modules/identity/identity.module.ts:151` — `forwardRef(() => CommsModule)`
- `apps/backend/src/modules/people/people.module.ts:77` — `forwardRef(() => BookingsModule)` و`forwardRef(() => IdentityModule)` (اثنان في سطر واحد)

> العدد 4 في وثيقة المراجعة يشمل استيراد رمز `forwardRef` نفسه؛ المواضع الفعلية ثلاثة أسطر، لكن `people.module.ts` يحوي استدعاءين، فالمجموع 4 استدعاءات. الوثيقة تعتمد عدد الاستدعاءات.

### `identity → people` — 27 موضع كتابة في 19 ملفًا

القرار المطلوب هو **أحد خيارين** ويجب أن يُوثق في ADR قبل أي كود:

1. **خدمة `people` ضيقة لحقول المصادقة** تستقبل `tx` وتُصدَّر من `PeopleModule`. هذا هو الخيار الموصى به لأنه يحافظ على الملكية.
2. **اعتبار `identity` مالكًا مشاركًا** لحقول محددة (`Client.passwordHash`، `Client.tokenVersion`، `Client.loginAttempts`، `Client.lockoutUntil`، `Client.lastLoginAt`) كاستثناء صريح في الـbaseline. هذا أسرع لكنه يكرّس الاقتران.

**الخطر الحقيقي:** `Client` موديل في `people.prisma` لكن نصف أعمدته أعمدة مصادقة. أي فصل بلا ADR إما يوسّع `identity` أو يخلق خدمة عابرة بلا ملكية واضحة.

### الطبقات المعكوسة الثلاث

- `apps/backend/src/common/guards/casl.guard.ts` — `common` يستورد `modules/identity/casl/casl-ability.factory`.
- `apps/backend/src/infrastructure/ai/ai-provider-client.service.ts` — `infrastructure` يستورد `modules/ai/provider-config`.
- `apps/backend/src/infrastructure/ai/chat.adapter.ts` — نفس الاتجاه.

## ما أُنجز مع دليل

- **قياس آلي متكرر** — `node scripts/check-backend-boundaries.mjs` (exit 0) و`node scripts/check-backend-boundaries.mjs --write-baseline` كأداة تحديث محكومة.
- **الـbaseline يحوي 250 مدخلًا** — `scripts/backend-boundaries-baseline.json`، منها 19 مدخلًا لـ`identity -> people` و3 لـ`people -> identity` و3 لـ`layer`.
- **جرد `forwardRef`** — `rg -n 'forwardRef' apps/backend/src/modules --glob '!*.spec.ts'` يثبت المواضع أعلاه.
- **جرد استيرادات `identity ↔ people`** — `rg -n "from '.*people" apps/backend/src/modules/identity` و`rg -n "from '.*identity" apps/backend/src/modules/people` يثبتان الملفات والاتجاهات.
- **اختبارات E2E للمصادقة والصلاحيات** — `test:e2e:critical` يشمل `identity-casl` و`client-auth` و`native-session` و`single-use-token-race` و`mobile-client-identity` و`employee-self-profile`.
- **الخطة الأصلية** — `docs/plans/maintainability-roadmap.md` تحدد الخطوات والقبول.

**غير مُتحقق:** لم تُشغَّل اختبارات الخلفية الكاملة في هذه الجلسة، ولم يُكتب ADR بعد. لا توجد موافقة مالك على أي من خياري `identity → people`.

## ما تبقى

| # | المهمة | المالك | معيار الإنجاز |
|---|---|---|---|
| 19.1 | كتابة ADR لاختيار ملكية حقول المصادقة في `Client` | المالك + DeepSeek | ADR معتمد في `docs/architecture/` يحدد الخيار والبديل المرفوض |
| 19.2 | تنفيذ الخيار المعتمد في ADR | DeepSeek | `identity -> people` ينخفض من 19 إلى 0 أو إلى الاستثناء الموثق |
| 19.3 | إزالة `forwardRef` بين `identity` و`comms` عبر حدث أو استخراج الجزء المشترك | DeepSeek | صفر `forwardRef` بينهما، و`comms.module.spec.ts` يمر |
| 19.4 | إزالة `forwardRef` بين `comms` و`people` | DeepSeek | صفر استدعاء، والاختبارات تمر |
| 19.5 | إزالة `forwardRef` بين `people` و`bookings`/`identity` | DeepSeek | صفر استدعاء، و`bookings.module.spec.ts` و`people` specs تمر |
| 19.6 | معالجة `common/guards/casl.guard.ts` — نقل المصنع أو عكس الاعتماد | المالك + DeepSeek | صفر `layer common -> modules` أو استثناء موثق |
| 19.7 | معالجة `infrastructure/ai` | DeepSeek | صفر `layer infrastructure -> modules` أو استثناء موثق |
| 19.8 | تحديث الـbaseline والخطة | DeepSeek | حذف فقط في `git diff`، وسطر مراجعة جديد |

**الترتيب الإلزامي:** 19.1 قبل 19.2؛ و19.3 قبل 19.4؛ ولا يبدأ 19.6 قبل موافقة مالك لأنه يمس CASL (درجة حرجة).

## المخاطر

- **CASL وصلاحيات** — الأثر: تجاوز صلاحيات أو حجب وصول شرعي. التخفيف: `identity-casl.real-e2e-spec.ts` إلزامي، وموافقة مالك، وعدم تغيير منطق `assertCanManageUser`.
- **`Client` يجمع المصادقة والبيانات الشخصية** — الأثر: نقل خاطئ يكسر تسجيل الدخول أو OTP أو إعادة تعيين كلمة المرور. التخفيف: ADR أولًا، واختبارات `client-auth` و`mobile-password-login` و`mobile-email-entry` و`verify-otp`.
- **الأحداث غير المتزامنة تكسر التزامن** — الأثر: فقدان إشعار أو تغيير حالة. التخفيف: استخدام outbox القائم لا حدث عابر، واختبارات `outbox` عند الحاجة.
- **`forwardRef` إزالته قد تكشف دورة أعمق** — الأثر: فشل تشغيل التطبيق أو اختبارات الوحدة. التخفيف: PR لكل زوج، وتشغيل `pnpm --filter backend test` كاملًا.
- **الاستثناءات في الـbaseline** — الأثر: تصبح دَينًا صامتًا. التخفيف: كل استثناء يحتاج سببًا وتاريخًا في ADR أو تعليق الـbaseline.

## كيفية التشغيل والتحقق

```bash
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0=false

git worktree add .worktrees/mnt19 -b codex/mnt-19-module-cycles origin/integration/maintainability
cd .worktrees/mnt19
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @sawaa/shared build
```

```bash
node scripts/check-backend-boundaries.mjs
pnpm --filter backend test
pnpm --filter=backend run test:e2e:critical
```

قبل الدمج:

```bash
node scripts/check-backend-boundaries.mjs
git diff -- scripts/backend-boundaries-baseline.json
```

يجب أن يُظهر الفرق حذف سطور فقط. أي إضافة تحتاج تبريرًا في وصف الـPR.

## القرارات

- **ADR قبل الكود في `identity → people`** — البديل المرفوض: اختيار سريع في الـPR. السبب: يمس الهوية والصلاحيات، وقرار الملكية يجب أن يكون مرئيًا وقابلًا للنقض.
- **الخيار الموصى به: خدمة `people` ضيقة** — البديل المرفوض: ملكية مشاركة. السبب: يحفظ مبدأ «كل جدول له مالك» ويمنع توسع الاقتران.
- **PR لكل زوج وحدات** — البديل المرفوض: PR واحد لكل الأزواج. السبب: كل زوج له اختبارات ومخاطر مختلفة، والعزل يقلل الرجوع.
- **الاعتماد على `check-backend-boundaries` كحكم** — البديل المرفوض: العد اليدوي. السبب: الفحص آلي ومقفل بالـbaseline، والعد اليدوي لا يُثبت شيئًا.

## جهات الاتصال ومسارات الملفات

- **مالك القرار:** طارق الوليدي — الهوية والصلاحيات درجة حرجة.
- **المنفذ:** DeepSeek — بتوجيه ومراجعة من الوكيل الرئيسي.
- **الخطة:** `docs/plans/maintainability-roadmap.md`
- **الحارس:** `scripts/check-backend-boundaries.mjs`
- **الـbaseline:** `scripts/backend-boundaries-baseline.json`
- **CASL:** `apps/backend/src/modules/identity/casl/` و`apps/backend/src/common/guards/casl.guard.ts`
- **AI:** `apps/backend/src/infrastructure/ai/`
- **اختبارات الهوية:** `apps/backend/test/e2e/identity/` و`apps/backend/test/e2e/auth/`
