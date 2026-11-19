# ADR-002 — ملكية حقول المصادقة بين `identity` و`people`

- **الحالة:** مقترح — بانتظار قرار المالك (طارق الوليدي)
- **التاريخ:** 2026-11-19
- **البند:** MNT-19.1 (الخطوة الأولى في الموجة 1 من خطة قابلية الصيانة)
- **نطاق القرار:** ملكية الكتابة والقراءة على حقول المصادقة في جدول `Client`، لا إعادة تصميم المصادقة
- **درجة الحساسية:** حرجة — هوية وصلاحيات (تتطلب موافقة مالك صريحة قبل أي كود)
- **الفرع:** `codex/mnt-19-identity-adr` من `origin/integration/maintainability` عند `ebdddce4e5f261f4f598a10ab710661a6bb46073`

> هذا المستند **قرار معماري فقط**. لم يُعدَّل أي كود إنتاجي أو اختبار في هذه الجلسة.

---

## 1. السياق والمشكلة

`Client` يعيش في `apps/backend/prisma/schema/people.prisma`، أي أن `people` مالكة الجدول باسم الملف. لكن **عددًا كبيرًا** من أعمدته يحمل دلالات مصادقة لا دلالات بيانات شخصية. النتيجة أن `identity` — مالكة منطق المصادقة — تكتب مباشرة على جدول مملوك لـ`people` عبر `PrismaService` داخل معاملاتها.

هذا أكبر مصدر اقتران في الخلفية، وهو ما يمنع إغلاق MNT-19:

| القياس (منفَّذ في هذه الجلسة) | القيمة |
|---|---:|
| `module import edges` | 36 (202 عبارة استيراد في 126 ملفًا) |
| `bidirectional module pairs` | 8 |
| `reverse-layer import entries` | 3 |
| `cross-cluster Prisma write call sites` | 135 (منها 39 على جداول `ops` المسموحة) |
| `baseline-tracked entries` | 250 |

### 1.1 الأرقام الفعلية لزوج `identity ↔ people`

الهاند أوف (`docs/plans/handoffs/MNT-19.md`) يذكر «27 موضع كتابة في 19 ملفًا». التحقق الفعلي يعطي التفصيل التالي، وهو المعتمد هنا:

**`identity → people` — 20 مدخلًا في 20 ملفًا:**

| النوع | مدخلات baseline | مواضع في الكود |
|---|---:|---:|
| `import identity -> people` | 1 | 1 ملف (ملف `get-me`) |
| `write identity -> people.client` | 16 | 23 استدعاءً |
| `write identity -> people.employee` | 2 | 2 |
| `write identity -> people.passwordHistory` | 1 | 2 |

**مواضع الكتابة الفعلية: 27 استدعاءً** (`client`: 23، `employee`: 2، `passwordHistory`: 2). الـbaseline يحصي **على مستوى الملف**، فيظهر 19 مدخل كتابة مقابل 27 استدعاءً. الرقمان متوافقان؛ أي ادعاء لاحق يجب أن يحدد أي مقياس يقصد.

**`people → identity` — 10 مدخلات في 9 ملفات:**

| النوع | العدد |
|---|---:|
| `import people -> identity` | 7 |
| `write people -> identity.clientRefreshToken` | 1 |
| `write people -> identity.user` | 2 |

**`forwardRef` النشط في الخلفية — 4 استدعاءات في 3 أسطر:**

- `apps/backend/src/modules/identity/identity.module.ts:151` → `CommsModule`
- `apps/backend/src/modules/comms/comms.module.ts:220` → `PeopleModule`
- `apps/backend/src/modules/people/people.module.ts:77` → `BookingsModule` و`IdentityModule` (استدعاءان)

**الطبقات المعكوسة — 3 مدخلات:** `common/guards/casl.guard.ts` → `modules/identity`، و`infrastructure/ai/ai-provider-client.service.ts` و`infrastructure/ai/chat.adapter.ts` → `modules/ai`.

### 1.2 أعمدة `Client` تصنيفًا حسب من يكتبها

`Client` فيه 40 عمودًا. التصنيف مبني على فحص كل موضع كتابة فعلي، لا على أسماء الأعمدة:

**أ. أعمدة مصادقة صرفة — `identity` هي الكاتب الوحيد:**

| العمود | الدلالة | مواضع الكتابة |
|---|---|---|
| `passwordHash` | تجزئة كلمة المرور | register, reset-password, request-account-deletion |
| `tokenVersion` | إبطال كل رموز JWT في خطوة واحدة | reset-password, verify-client-phone, native-logout, request-account-deletion |
| `loginAttempts` | عدّاد محاولات الدخول | client-login, reset-password |
| `lockoutUntil` | قفل الحساب مؤقتًا | client-login, reset-password |
| `lastLoginAt` | آخر دخول ناجح | client-login, verify-phone-entry, complete-phone-entry, verify-email-entry |
| `pendingEmail` | بريد مُدخل بانتظار إثبات — **لا يُستخدم للدخول إطلاقًا** | client-email, complete-phone-entry |
| `emailPromptResolvedAt` | حالة عرض طلب البريد | client-email |

**ب. أعمدة إثبات قناة (proof state) — ملكية مشتركة فعليًا اليوم:**

| العمود | من يكتبه |
|---|---|
| `emailVerified` | `identity` (register, reset-password, client-email, mobile-email-entry, request-account-deletion) **و** `people` (`clients/update-client.handler.ts:67` يصفّرها عند تغيير البريد) |
| `phoneVerified` | `identity` فقط (register, reset-password, client-phone, otp, mobile-*, verify-mobile-otp) |

**ج. معرّفات الدخول — يكتبها الطرفان:**

| العمود | من يكتبه |
|---|---|
| `email` | `identity` (register, client-email, mobile-email-entry, request-account-deletion) و`people` (`update-client.handler.ts`) |
| `phone` | `identity` (register, client-phone, mobile-phone-entry, request-account-deletion) و`people` (`update-client.handler.ts`) |

**د. بيانات تسجيل وملف شخصي — يكتبها `identity` لأسباب مشروعة لا علاقة لها بالمصادقة:**

`name`, `firstName`, `lastName`, `avatarUrl`, `preferredLocale`, `pushEnabled`, `accountType`, `claimedAt`, `source`, `consentedAt`, `consentVersion`, `isActive`, `deletedAt`, `nationalId`, `emergencyName`, `emergencyPhone`.

**الاستنتاج الحاسم:** الاقتران ليس «مصادقة فقط». `identity` تكتب أيضًا **بيانات تسجيل وملف شخصي**، لأنها تملك مسار إنشاء الحساب الذاتي (`register`, `complete-phone-entry`, `verify-email-entry-phone`, `verify-mobile-otp` تنشئ صفوف `Client` جديدة) ومسار حذف الحساب (`request-account-deletion`). أي حل يفترض أن «كل كتابات `identity` على `Client` مصادقة» سيكون خاطئًا ويترك اقترانًا مخفيًا.

### 1.3 قراءة `Client` من `identity`

`identity` تقرأ `Client` في **40 موضع قراءة داخل 24 ملفًا** (`findFirst/findUnique/findMany/count`). أي واجهة ضيقة يجب أن تغطي القراءة أيضًا، وإلا بقيت الاستيرادات والملكية غامضة.

### 1.4 ملكية `PasswordHistory`

`PasswordHistory` (في `people.prisma`) **لا يقرؤها ولا يكتبها إلا `identity`** عبر `client-auth/shared/password-history.service.ts` وحده. عمليًا هو جدول `people` بمنطق `identity` بالكامل.

### 1.5 ما يفعله حارس الحدود فعليًا (تحقق تجريبي)

هذا مهم لتقييم الخيارات بدقة، وقد تحقّقت منه بتشغيل السكربت على أشجار مصغّرة:

1. الحارس يقارن **نص المدخلات** لا الأعمدة. المدخل `write identity -> people.client (file)` يعني «هذا الملف يكتب على جدول مملوك لـpeople» — **لا يرى أي عمود**.
2. استيراد **ملف** من `modules/people` يُحتسب `import identity -> people`. استيراد **عقد/واجهة** من `src/common` أو من حزمة خارجية **لا يُحتسب شيئًا** (لأن `classify` يعيد `other`/`layer`، والقاعدة تُسجّل فقط عندما يكون الطرفان وحدة).
3. لذلك: **نقل الواجهة إلى مكان محايد يخفض مدخلات الاستيراد، ونقل الكتابة إلى مالك الجدول يخفض مدخلات الكتابة — وهما تعديلان مستقلان.**

---

## 2. الخيار أ — خدمة `people` ضيقة تستقبل `tx` (الموصى به)

### 2.1 الفكرة

تُعرَّف واجهة عقد في مكان محايد (`apps/backend/src/common/contracts/`)، وتُنفَّذ في `people`، وتُصدَّر عبر `PeopleModule`. `identity` تحقن الواجهة وتستدعيها ممرِّرة `tx` الخاص بها، فتبقى المعاملة واحدة والذرّية محفوظة، وتصبح الكتابة على جدول `Client` من داخل `people` فقط.

**لماذا العقد في `common` وليس في `people`؟** لأن استيراد ملف فعلي من `modules/people` يُحتسب اقترانًا حتى لو كان واجهةً فقط (§1.5-2). العقد في `common` يحقق هدفين: يخفض مدخلات الاستيراد، ويجعل الاتجاه `modules → common` (اتجاه طبقي سليم) بدل `modules → modules`. الشرط: ملف العقد **لا يستورد شيئًا من `modules/`** حتى لا يُنشئ `layer common -> modules` معكوسًا.

### 2.2 شكل الواجهة المقترح (توصيف، لا كود نهائي)

```ts
// apps/backend/src/common/contracts/client-account.contract.ts
import type { Prisma } from '@prisma/client';

export const CLIENT_ACCOUNT_STORE = Symbol('CLIENT_ACCOUNT_STORE');

/** إسقاط صريح — لا يُعاد صف Client كامل. */
export interface ClientAuthView {
  id: string; userId: string | null;
  email: string | null; emailVerified: Date | null;
  phone: string | null; phoneVerified: Date | null;
  passwordHash: string | null; tokenVersion: number;
  isActive: boolean; deletedAt: Date | null;
  loginAttempts: number; lockoutUntil: Date | null;
}

export interface ClientAccountStore {
  findByIdentifier(tx: Prisma.TransactionClient, by: { email?: string; phone?: string }): Promise<ClientAuthView | null>;
  lockForAuth(tx: Prisma.TransactionClient, clientId: string): Promise<ClientAuthView | null>;
  createRegisteredClient(tx: Prisma.TransactionClient, input: NewRegisteredClient): Promise<ClientAuthView>;
  setPasswordHash(tx: Prisma.TransactionClient, clientId: string, hash: string): Promise<void>;
  bumpTokenVersion(tx: Prisma.TransactionClient, clientId: string): Promise<number>;
  recordFailedLogin(tx: Prisma.TransactionClient, clientId: string, next: { attempts: number; lockoutUntil: Date | null }): Promise<void>;
  clearFailedLogin(tx: Prisma.TransactionClient, clientId: string): Promise<void>;
  markLastLogin(tx: Prisma.TransactionClient, clientId: string, at: Date): Promise<void>;
  setEmailProof(tx: Prisma.TransactionClient, clientId: string, next: { email: string; verifiedAt: Date }): Promise<void>;
  clearEmailProof(tx: Prisma.TransactionClient, clientId: string): Promise<void>;
  setPendingEmail(tx: Prisma.TransactionClient, clientId: string, pending: string | null): Promise<void>;
  setPhoneProof(tx: Prisma.TransactionClient, clientId: string, next: { phone: string; verifiedAt: Date }): Promise<void>;
  anonymizeForDeletion(tx: Prisma.TransactionClient, clientId: string, at: Date): Promise<void>;
  recordPasswordHistory(tx: Prisma.TransactionClient, clientId: string, hash: string, depth: number): Promise<void>;
  listRecentPasswordHashes(tx: Prisma.TransactionClient, clientId: string, limit: number): Promise<string[]>;
}
```

قواعد ملزمة على العقد:

1. **`tx` إلزامي.** الخدمة لا تفتح معاملة خاصة ولا تستخدم `PrismaService` في المسارات المستدعاة من داخل معاملة قائمة. هذا يحمي `SEC-AUTH-02` (سباق إعادة التعيين مع التجديد) ويحافظ على أقفال `SELECT ... FOR UPDATE`.
2. **لا تمرير `Prisma.ClientUpdateInput`.** كل عملية تستقبل حقولها المسماة فقط، فلا تستطيع `identity` الكتابة على عمود غير مُدرج في العقد.
3. **`ClientAuthView` نوع إسقاطي صريح** — لا يُسرّب صف `Client` كاملًا (يحافظ على سلوك `client.serializer.ts` الذي يخفي `passwordHash` و`tokenVersion` و`loginAttempts` و`lockoutUntil` و`pendingEmail` و`emailPromptResolvedAt`).
4. **`PasswordHistory` يبقى في `people`** وتُدار كتابته وقراءته عبر العقد. البديل — نقله إلى `identity.prisma` بمهاجرة جديدة مضافة — ممكن لكنه يفتح ملف مخطط حساس دون حاجة، ولا يوصى به الآن.

### 2.3 الملكية بعد التطبيق

| العنصر | المالك |
|---|---|
| جدول `Client` وسياسة أعمدته | `people` (مالك الجدول) |
| دلالات حقول المصادقة (`passwordHash`, `tokenVersion`, `loginAttempts`, `lockoutUntil`, `lastLoginAt`, `pendingEmail`, `emailPromptResolvedAt`) | `identity` — **مفروضة عبر العقد**، لا عبر الكتابة المباشرة |
| إثبات القناة (`emailVerified`, `phoneVerified`) | `identity` تقرر «متى»، و`people` تنفّذ الكتابة عبر العقد؛ ومسار لوحة التحكم في `people` يمر عبر العملية نفسها |
| بيانات الملف الشخصي | `people` |
| إنشاء عميل أثناء التسجيل | ينفّذه `people` عبر `createRegisteredClient` بمدخلات يحددها `identity` |
| `PasswordHistory` | `people` (الجدول) بعقد يقوده `identity` |

### 2.4 الحد الصريح لهذا الخيار (قُرِّر بعد تحقق تجريبي)

الخيار أ بصيغته المصححة (عقد في `common` + تنفيذ في `people`) يُنجز:

- **19 مدخل `write identity -> people.*` ← 0** (كل الكتابة تصبح داخل `people` على جدولها).
- **20 ملف `import identity -> people` ← 1 مدخل** فقط: استيراد `PeopleModule` مرة واحدة في `identity.module.ts` لتوفير المزوّد. الملفات العشرون تستورد العقد من `common`، وهو ما لا يُحتسب (تحقق: أي module يستورد ملف `common` يُنتج صفر مدخلات).
- **`identity ↔ people` يبقى زوجًا ثنائي الاتجاه**، لأن `people → identity` فيه 7 استيرادات و3 كتابات مستقلة لم يعالجها هذا الخيار.

**النتيجة الصريحة:** الخيار أ وحده **لا** يحقق معيار قبول MNT-19 (زوجان أو أقل). هو يزيل مدخلات الكتابة ويخفض الاستيراد من 20 إلى 1، لكن الزوج يبقى قائمًا حتى تُنفَّذ 19.4/19.5 (`people → identity`). أي وثيقة تَعِد بأنه وحده يغلق MNT-19 تكون غير دقيقة.

### 2.5 اختبارات القبول للخيار أ

```bash
node scripts/check-backend-boundaries.mjs          # exit 0، و0 مدخل write identity -> people
node --test scripts/check-backend-boundaries.test.mjs
pnpm --filter=backend test
pnpm --filter=backend run test:e2e:critical        # 43 ملفًا موجَبًا، منها 9 auth/identity
```

وعلى مستوى السلوك، يجب أن تبقى العمليات التالية صحيحة بعد التحويل:

| السيناريو | الاختبار المرجعي | داخل بوابة `critical`؟ |
|---|---|---|
| تسجيل/دخول بالبريد وكلمة المرور | `test/e2e/auth/client-auth.real-e2e-spec.ts` | نعم |
| قفل الحساب بعد محاولات فاشلة | `client-auth.real-e2e-spec.ts` (Login) | نعم |
| تجديد الجلسة وإبطالها بعد إعادة التعيين | `client-auth.real-e2e-spec.ts` (Refresh, Password reset) | نعم |
| OTP والجلسة أحادية الاستخدام | `single-use-token-race`, `mobile-review-otp` | نعم |
| الدخول من الجوال بالبريد/الهاتف | `mobile-email-entry`, `mobile-password-login`, `mobile-client-identity` | نعم |
| الجلسة الأصلية وتسجيل الخروج | `native-session.real-e2e-spec.ts` | نعم |
| صلاحيات CASL | `test/e2e/identity/identity-casl.real-e2e-spec.ts` | نعم |
| الملف الشخصي للموظف | `employee-self-profile.real-e2e-spec.ts` | نعم |
| حذف الحساب | `test/e2e/auth/account-closure.real-e2e-spec.ts` | **لا — يجب تشغيله يدويًا** |

كما تُضاف اختبارات وحدة للخدمة الجديدة تغطي: رفض أي حقل خارج العقد، وإلزامية `tx`، وسلوك `bumpTokenVersion` المتزامن، وعدم كشف الحقول الحساسة في `ClientAuthView`.

---

## 3. الخيار ب — ملكية مشاركة موثّقة لحقول محددة

### 3.1 الفكرة

تُعلَن قائمة حقول مصادقة في `Client` مملوكة **مشاركةً** بين `identity` و`people`، وتُسجَّل كاستثناء صريح في `scripts/backend-boundaries-baseline.json` مع سبب وتاريخ. تبقى كتابات `identity` المباشرة كما هي.

### 3.2 النطاق المقترح للاستثناء

الحقول في §1.2-أ و§1.2-ب فقط: `passwordHash`, `tokenVersion`, `loginAttempts`, `lockoutUntil`, `lastLoginAt`, `pendingEmail`, `emailPromptResolvedAt`, `emailVerified`, `phoneVerified`.

### 3.3 لماذا يُرفض

1. **السكربت لا يفهم الأعمدة (§1.5-1).** «استثناء لحقول محددة» غير قابل للتعبير في الـbaseline الحالي إلا بإضافة قدرة تحليل أعمدة إلى الحارس نفسه — أي تعديل على حارس حدود بموافقة مالك — أو بإسكات المدخل كاملًا، فيصبح الاستثناء على مستوى الملف لا العمود.
2. **يُكرّس الاقتران بدلًا من حله.** مدخل واحد في الـbaseline يفتح الباب لكل كتابة مستقبلية على نفس الملف دون مراجعة.
3. **لا يعالج الجذر.** `identity` ستبقى تعرف شكل `Client` وتحدّثه، ولن يكون لأي حقل مالك واضح.
4. **الكلفة الفعلية منخفضة نسبيًا للخيار أ** (عقد واحد + تحويل 27 استدعاءً) مقارنة بحمل استثناء دائم.

### 3.4 متى يُقبل كخيار احتياطي

فقط إذا ثبت أن الخيار أ يخلق دورة معاملات لا يمكن كسرها (مثلًا: تنفيذ الخدمة يحتاج إلى استدعاء منطق `identity` داخل نفس المعاملة فينشأ `people → identity → people`). في تلك الحالة يُوثَّق الاستثناء **لكل ملف على حدة** في الـbaseline، ويُعاد تقييمه في كل مراجعة ربعية.

---

## 4. القرار الموصى به

**اعتماد الخيار أ** بصيغته المصححة (عقد في `common/contracts` + تنفيذ في `people` + حقن عبر `PeopleModule`)، للأسباب التالية:

1. يحفظ قاعدة «لكل جدول مالك» التي يقوم عليها حارس الحدود، بدلًا من استثناء دائم.
2. يجعل حقول المصادقة **مُعدَّدة في عقد**، فيصبح أي توسّع فيها ظاهرًا في المراجعة لا مخفيًا داخل `Prisma.ClientUpdateInput`.
3. لا يلمس منطق CASL ولا الـguards ولا دلالات الرموز — يغيّر **موضع الكتابة** فقط.
4. قابل للتنفيذ تدريجيًا ملفًا بملف، وكل ملف قابل للرجوع منفردًا.
5. يخفض مدخلات `identity → people` من 20 إلى 1، وهو شرط عملي لإغلاق MNT-19 بعد إصلاح `people → identity`.

**الشرط المصاحب:** لا يُعلن MNT-19 مكتملًا بعد الخيار أ؛ يبقى الزوج ثنائي الاتجاه حتى تُنفَّذ 19.4/19.5.

**ما لا يقرره هذا الـADR:** موضع نقل الجزء المشترك (`NormalizePhone`, `assertCanManageEmployeeUser`)، وإزالة `forwardRef` — تحتاج ADR أو PR منفصلًا (MNT-19.3–19.5). أي مساس بـ`casl.guard.ts` يحتاج موافقة مالك لأنه درجة حرجة.

---

## 5. خطة ترحيل تدريجية وقابلة للرجوع

كل مرحلة في PR مستقل إلى `integration/maintainability`، بـ**merge commit فقط**، ولا تبدأ المرحلة التالية قبل خضرة `gate` و`critical-real-e2e`.

| المرحلة | العمل | معيار الخروج | الرجوع |
|---|---|---|---|
| **0** | هذا الـADR + قرار المالك | موافقة مالك مسجّلة في PR | حذف الملف |
| **1** | إضافة `common/contracts/client-account.contract.ts` + تنفيذ `PgClientAccountStore` في `people` + رمز الحقن، بدون تغيير أي مستهلك | الخدمة تُبنى ولها اختبارات وحدة؛ **صفر تغيير في الـbaseline** | حذف الملفين وإسقاط المزوّد |
| **2** | تحويل `client-login` + `reset-password` + `client-refresh` (المسار الأخطر على `tokenVersion`) | 3 ملفات تختفي من مدخلات `write`، و`client-auth` e2e يمر | `git revert` لالتزام واحد |
| **3** | تحويل `client-email/*` + `client-phone/*` (إثبات القناة) | مدخلات `write` لتلك الملفات = 0، و`client-email`/`mobile-email-entry` e2e يمر | `git revert` لكل PR |
| **4** | تحويل `mobile-*` + `otp` + `verify-mobile-otp` (بما فيها **إنشاء** `Client`) | مدخلات `write` = 0، و`mobile-*`/`single-use-token-race` يمر | `git revert` |
| **5** | تحويل `native-session` + `request-account-deletion` + `employee-account`/`employee-contact` + `register` + `password-history` | مدخلات `write identity -> people` = 0، و`account-closure` يمر | `git revert` |
| **6** | تحويل `get-me` (آخر استيراد لملف من `people`) إلى العقد، وإدخال `PeopleModule` في `identity.module.ts` | مدخلات `import identity -> people` = 1، والفحص يمر | `git revert` |

في كل مرحلة:

- **قبل:** `node scripts/check-backend-boundaries.mjs` يجب أن يفشل بـ«stale baseline» بعد كل تحويل — هذا هو الإثبات أن الاقتران انخفض فعليًا.
- **بعد:** الـbaseline يُحدَّث **بحذف السطور المصلحة يدويًا فقط**، و`git diff -- scripts/backend-boundaries-baseline.json` يجب أن يُظهر حذفًا فقط (قاعدة الهاند أوف).
- **الرجوع الكلي:** `git revert` لكل PR على حدة. لا migrations في هذا المسار، فلا رجوع بيانات مطلوب.

**قاعدة أمان:** لا تُغيَّر أي migration. أعمدة `Client` تبقى في `people.prisma`؛ الترحيل هنا ترحيل **كود** لا **مخطط**.

**تحذير تشغيلي:** عند إدخال `PeopleModule` في `identity.module.ts` (المرحلة 6) قد تظهر دورة `identity → people → identity` (لأن `people.module.ts` يستورد `IdentityModule` بالفعل عبر `forwardRef`). هذا متوقع ومحدود: يتطلب `forwardRef` إضافيًا واحدًا أو — الأفضل — نقل مزوّد العقد إلى `DatabaseModule` العام. يجب قياس ذلك في المرحلة 6 لا افتراضه.

---

## 6. المخاطر والتخفيف

| الخطر | الأثر | التخفيف |
|---|---|---|
| **CASL والصلاحيات** | تجاوز صلاحيات أو حجب وصول شرعي | لا يلمس القرار `casl.guard.ts` ولا `role-rank`. `identity-casl.real-e2e-spec.ts` إلزامي. أي تغيير في الحارس يحتاج ADR وموافقة مالك منفصلة |
| **OTP** | قبول/رفض رمز خاطئ أو تمكين حساب غير مُثبت | `single-use-token-race` و`mobile-review-otp` يجب أن تمر. العقد لا يغيّر منطق التحقق، فقط موضع الكتابة |
| **تسجيل الدخول** | تعطيل دخول أو كشف وجود الحساب | الحفاظ على `DUMMY_PASSWORD_HASH` وتسلسل `countClientPasswordAttempt` خارج العقد. `ClientAuthView` يجب أن يحمل `passwordHash` و`lockoutUntil` وإلا انكسر القفل |
| **إعادة تعيين كلمة المرور** | كسر سلسلة `tokenVersion` + `PasswordHistory` + إبطال `clientRefreshToken` | تنفيذ المرحلة 2 أولًا، `bumpTokenVersion` داخل نفس `tx`، والاحتفاظ بقفل `SELECT ... FOR UPDATE` على `Client` |
| **حذف الحساب** | بقاء جلسات حيّة أو بيانات شخصية غير مُجهَّلة | `account-closure.real-e2e-spec.ts` — **يُشغَّل يدويًا لأنه خارج بوابة `critical`** |
| **كسر الذرّية (معاملة داخل معاملة)** | أخطاء وقت التشغيل أو تجاوزات سباق | إلزام `tx` في العقد؛ مراجعة كل استدعاء للتأكد أنه داخل `withTransaction`/`$transaction` |
| **`emailVerified` يُكتب من `people`** | مسار لوحة التحكم يصفّر الإثبات دون المرور بالعقد | المرحلة 1 تُدرج `clearEmailProof` في العقد؛ المرحلة 6 تنقل `update-client.handler.ts` إليها |
| **`common` تنمو بعقود الوحدات** | تحوّل `common` إلى مركز اقتران جديد | العقد واجهة صرفة لا تستورد من `modules`؛ ومراجعة ربعية لأي إضافة إلى `common/contracts` |
| **عودة الاقتران صامتًا** | إعادة كتابة مباشرة مستقبلًا | الحارس + baseline مُنقَّص يمنعان أي `write identity -> people` جديد؛ يُضاف اختبار وحدة يثبت أن `modules/identity` لا تحتوي `tx.client` |

---

## 7. الملفات المتأثرة

### 7.1 ملفات تُضاف

```text
apps/backend/src/common/contracts/client-account.contract.ts            (جديد — واجهة + رمز حقن + نوع ClientAuthView)
apps/backend/src/modules/people/clients/client-account.store.ts         (جديد — التنفيذ بـPrisma)
apps/backend/src/modules/people/clients/client-account.store.spec.ts    (جديد)
```

### 7.2 ملفات تُعدَّل — `people`

```text
apps/backend/src/modules/people/people.module.ts                    (تسجيل المزوّد وتصديره)
apps/backend/src/modules/people/clients/update-client.handler.ts    (المرحلة 6 — تصفير emailVerified عبر العقد)
```

### 7.3 ملفات تُحوَّل — `identity` (20 ملفًا)

```text
apps/backend/src/modules/identity/client-auth/client-login.handler.ts
apps/backend/src/modules/identity/client-auth/get-me.handler.ts
apps/backend/src/modules/identity/client-auth/register.handler.ts
apps/backend/src/modules/identity/client-auth/reset-password/reset-password.handler.ts
apps/backend/src/modules/identity/client-auth/shared/password-history.service.ts
apps/backend/src/modules/identity/client-auth/update-client-profile.handler.ts
apps/backend/src/modules/identity/client-email/decline-client-email.handler.ts
apps/backend/src/modules/identity/client-email/request-client-email.handler.ts
apps/backend/src/modules/identity/client-email/verify-client-email.handler.ts
apps/backend/src/modules/identity/client-phone/verify-client-phone.handler.ts
apps/backend/src/modules/identity/employee-account/create-employee-account.handler.ts
apps/backend/src/modules/identity/employee-contact/verify-employee-contact.handler.ts
apps/backend/src/modules/identity/mobile-email-entry/verify-email-entry-phone.handler.ts
apps/backend/src/modules/identity/mobile-email-entry/verify-email-entry.handler.ts
apps/backend/src/modules/identity/mobile-phone-entry/complete-phone-entry.handler.ts
apps/backend/src/modules/identity/mobile-phone-entry/verify-phone-entry.handler.ts
apps/backend/src/modules/identity/native-session/native-logout.handler.ts
apps/backend/src/modules/identity/otp/verify-otp.handler.ts
apps/backend/src/modules/identity/request-account-deletion/request-account-deletion.handler.ts
apps/backend/src/modules/identity/verify-mobile-otp/verify-mobile-otp.handler.ts
```

كذلك `apps/backend/src/modules/identity/identity.module.ts` في المرحلة 6 فقط.

### 7.4 ملفات لا تُلمس في هذا المسار

```text
apps/backend/src/common/guards/casl.guard.ts
apps/backend/src/modules/identity/casl/**
apps/backend/prisma/**                      (لا migration، لا تغيير مخطط)
apps/backend/openapi.json                   (لا تغيير عقد HTTP)
apps/backend/test/e2e/**                    (الاختبارات موجودة؛ لا تُعدَّل لإخفاء فشل)
.github/**
AGENTS.md / CLAUDE.md
scripts/backend-boundaries-baseline.json    (يُحدَّث بالحذف فقط في مراحل التنفيذ، لا في هذا الـADR)
```

### 7.5 ملفات الاتجاه المعاكس (خارج نطاق الخيار أ، مطلوبة لإغلاق MNT-19)

```text
apps/backend/src/modules/people/clients/create-client.dto.ts
apps/backend/src/modules/people/clients/update-client.dto.ts
apps/backend/src/modules/people/clients/set-client-active/set-client-active.handler.ts
apps/backend/src/modules/people/employees/create-employee.dto.ts
apps/backend/src/modules/people/employees/create-employee.handler.ts
apps/backend/src/modules/people/employees/update-employee.dto.ts
apps/backend/src/modules/people/employees/update-employee.handler.ts
apps/backend/src/modules/people/employees/self-profile/self-avatar.handler.ts
apps/backend/src/modules/people/people.module.ts
```

> ملاحظة: `NormalizePhone` و`assertCanManageEmployeeUser` هما سبب 6 من 7 استيرادات `people → identity` (الاستيراد السابع هو `people.module.ts` → `IdentityModule`)؛ نقلهما إلى مكان محايد خطوة مستقلة يجب أن تُقرَّر في ADR/PR خاص (MNT-19.4) لأنها تمس قواعد الصلاحيات.

---

## 8. أوامر التحقق (مع المخرجات المسجَّلة في هذه الجلسة)

```bash
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0=false
```

| الأمر | رمز الخروج | المخرج |
|---|---:|---|
| `node scripts/check-backend-boundaries.mjs` | 0 | 36 edge / 8 pairs / 3 layer / 135 write sites / 250 baseline — «match the baseline» |
| `node --test scripts/check-backend-boundaries.test.mjs` | 0 | 9 tests pass، 0 fail |
| تشغيل الحارس على شجرة مصغّرة (تحقق سلوك §1.5) | 0 | module→`common` = 0 مدخل؛ module→`modules/people` = مدخل لكل ملف |

أوامر يجب تشغيلها في مراحل التنفيذ (**لم تُشغَّل في هذه الجلسة** لأنها تتطلب قاعدة بيانات وتبعيات):

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter=backend test
pnpm --filter=backend run test:e2e:critical
pnpm --filter=backend exec jest --config test/jest-e2e.json --runInBand \
  --runTestsByPath test/e2e/auth/account-closure.real-e2e-spec.ts
```

**ما لم يتحقق في هذه الجلسة، ولا يُدَّعى:** لم تُشغَّل أي اختبارات خلفية كاملة، ولا أي e2e حقيقي، ولا `pnpm install`، ولا بناء. التحقق المنفَّذ هو: الفحص الآلي للحدود، واختبارات الحارس نفسها، وتجارب على أشجار مؤقتة لإثبات سلوك §1.5. لا يوجد أي تحقق سلوكي لمنطق المصادقة في هذا الـADR.

---

## 9. البدائل المرفوضة

| البديل | سبب الرفض |
|---|---|
| B: ملكية مشاركة موثّقة | مُكرِّس للاقتران، والحارس لا يعبّر عن استثناء على مستوى العمود (§3.3) |
| تعريف العقد داخل `modules/people` (بدل `common`) | استيراد ملف من `people` يُحتسب اقترانًا حتى لو كان واجهة صرفة؛ يترك 20 مدخل استيراد بدل 1 (§1.5-2) |
| وضع العقد في `src/infrastructure` | ممكن تقنيًا لكن `infrastructure` محجوز لخدمات البنية التحتية؛ `common/contracts` أدق دلاليًا. المهم ألّا يستورد العقد من `modules` |
| العقد يستورد أنواعًا من `modules/people` | يُنشئ `layer common -> modules/people` معكوسًا — وهو ما يحاول MNT-19 إزالته |
| نقل كل حقول المصادقة إلى جدول `ClientCredential` منفصل | يتطلب مهاجرة على جدول كبير وحساس، خارج نطاق «وثيقة قرار»، ويحتاج موافقة مالك وخطة ترحيل بيانات |
| نقل `Client` إلى `identity.prisma` | يقلب الملكية على `people` ويخلق اقترانًا أوسع في الاتجاه المعاكس |
| إخفاء الاقتران بنقل الملفات إلى مجلد لا يعرفه السكربت | تلاعب بالمؤشر لا إصلاح معماري؛ مرفوض صراحةً |
| تنفيذ كل الأزواج في PR واحد | مخالف لقاعدة «PR لكل زوج» في خطة MNT-19 |

---

## 10. حالة القرار

**مقترح، غير معتمد.** لا يُنفَّذ أي كود قبل موافقة المالك على:

1. الخيار (أ أو ب)،
2. موضع العقد (`src/common/contracts` كما هو مقترح، أم بديل)،
3. ملكية `PasswordHistory` (يبقى في `people` أم يُنقل؟),
4. الإقرار بأن MNT-19 لا يُغلق بالخيار أ وحده.

**المالك:** طارق الوليدي — الهوية والصلاحيات درجة حرجة.
**المنفذ المقترح:** DeepSeek بتوجيه ومراجعة الوكيل الرئيسي.
