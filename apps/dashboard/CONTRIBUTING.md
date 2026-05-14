# CONTRIBUTING — Deqah Dashboard

> اقرأ هذا الملف أولاً قبل كتابة أي سطر كود.
> يُكمّل: `CLAUDE.md` (القواعد الكاملة + Layer rules) + `DESIGN-SYSTEM.md` (التصميم) + `tokens.md` (مرجع التوكنز).

---

## 1. الإعداد السريع — Quick Setup

```bash
# تثبيت المكتبات
npm install

# تشغيل بيئة التطوير
npm run dev

# فحص TypeScript
npm run typecheck

# فحص القواعد المعمارية
npm run lint

# تنسيق الكود
npm run format
```

**المتطلبات:** Node.js 20+، npm 10+

---

## 2. قبل البدء — Before You Code

اقرأ هذه الملفات بالترتيب:

| الملف | ما ستعرفه |
|-------|-----------|
| `CLAUDE.md` | قواعد المشروع الكاملة + Layer rules + i18n + billing + terminology |
| `DESIGN-SYSTEM.md` | الـ frosted-glass design system، RTL، component patterns |
| `tokens.md` | مرجع الـ design tokens (الألوان، spacing، shadows…) |

---

## 3. هيكل المشروع — Project Structure

```
dashboard/
├── app/(dashboard)/          # Pages — orchestration فقط، لا business logic
│   └── [feature]/
│       ├── page.tsx          # الصفحة الرئيسية (max 120 سطر)
│       ├── [id]/page.tsx     # صفحة التفاصيل
│       └── create/page.tsx   # صفحة الإنشاء
│
├── components/
│   ├── ui/                   # App-local wrappers فقط (date-picker, nationality-select)
│   │                         #   shadcn primitives → @deqah/ui (workspace package)
│   └── features/
│       ├── [feature]/        # مكونات خاصة بكل feature
│       └── *.tsx             # shared components (3+ features)
│
├── hooks/                    # React Query hooks (global)
│   ├── use-[feature].ts      # queries
│   └── use-[feature]-mutations.ts  # mutations
│
├── lib/
│   ├── api/[feature].ts      # network calls فقط
│   ├── types/[feature].ts    # TypeScript types
│   ├── schemas/[feature].schema.ts  # Zod validation
│   ├── translations/         # i18n strings
│   ├── query-keys.ts         # TanStack Query cache keys
│   └── utils.ts              # pure utilities
│
└── docs/                     # وثائق داخلية للمشروع
```

---

## 4. قواعد الـ Layer — Layer Rules

```
app/  →  components/  →  hooks/  →  lib/
```

الاستيراد يسير **لأسفل فقط**. أي import في الاتجاه المعاكس = خطأ معماري.

### ممنوع مطلقاً

```ts
// ❌ cross-feature import
import { EmployeeCard } from "@/components/features/employees/employee-card"
// داخل ملف في features/bookings/

// ❌ lib تستورد من hooks
import { useClients } from "@/hooks/use-clients"
// داخل ملف في lib/

// ❌ hooks تستورد UI
import { Button } from "@/components/ui/button"
// داخل ملف في hooks/
```

> **ملاحظة:** هذه القواعد مُفعَّلة تلقائياً في ESLint — ستحصل على خطأ فوري عند المخالفة.

---

## 5. إضافة Feature جديدة — New Feature Checklist

عند إضافة feature جديدة (مثل `referrals`)، أنشئ هذه الملفات بالترتيب:

```
□ lib/types/referral.ts              # Type definitions
□ lib/schemas/referral.schema.ts     # Zod validation schemas
□ lib/api/referrals.ts               # API calls (max 200 سطر)
□ lib/query-keys.ts                  # أضف queryKeys.referrals.*
□ hooks/use-referrals.ts             # Query hooks
□ hooks/use-referral-mutations.ts    # Mutation hooks
□ components/features/referrals/     # Feature components
□ app/(dashboard)/referrals/page.tsx # Page
□ lib/translations/en.referrals.ts   # English strings
□ lib/translations/ar.referrals.ts   # Arabic strings
```

أضف اسم الـ feature في `eslint.config.mjs` ضمن مصفوفة `FEATURES`.

---

## 6. قواعد التصميم — Design Rules

- **ألوان:** semantic tokens فقط (`text-foreground`, `bg-primary`) — لا hex، لا `text-gray-*`
- **أيقونات:** `@hugeicons/react` فقط — لا Lucide، لا Heroicons
- **Inputs:** shadcn فقط — لا `<input>` أو `<select>` خام
- **RTL:** `ps-`/`pe-`/`ms-`/`me-` — لا `pl-`/`pr-`/`ml-`/`mr-`
- **Inline styles:** ممنوعة — استخدم CSS classes في `globals.css` للقيم الديناميكية

---

## 7. حدود الملفات — File Size Limits

| النوع | الحد |
|-------|------|
| أي ملف | **350 سطر** (مطلق، بلا استثناء) |
| Page component | 120 سطر |
| Feature component | 250 سطر |
| API file | 200 سطر |
| Hook file | 150 سطر |
| Type file | 250 سطر |
| Schema file | 150 سطر |

إذا اقترب ملف من الحد — قسّمه **الآن** لا بعد الـ PR.

---

## 8. التحقق قبل الـ PR — Pre-PR Checklist

```
□ npm run typecheck  →  0 errors
□ npm run lint       →  0 errors
□ لا يوجد ملف يتجاوز 350 سطر
□ لا cross-feature imports
□ كل query في use-[feature].ts
□ كل mutation في use-[feature]-mutations.ts
□ page.tsx لا يحتوي على business logic
□ لا hex colors أو text-gray-*
□ كل RTL spacing صحيح (ps-/pe-)
□ كل أيقونة من @hugeicons
□ لا inline styles
□ التوثيق محدَّث (إذا غيّرت أنماطاً عامة)
```

---

## 9. Commit Convention

```
feat(bookings): add cancellation confirmation dialog
fix(employees): correct availability overlap check
refactor(hooks): move booking slots hook to feature dir
chore(deps): upgrade tanstack-query to v5.95
docs(arch): update hook ownership rules
```

**الصيغة:** `type(scope): message`

| النوع | متى |
|-------|-----|
| `feat` | ميزة جديدة |
| `fix` | إصلاح خطأ |
| `refactor` | إعادة هيكلة بدون تغيير سلوك |
| `chore` | مهام صيانة |
| `docs` | توثيق فقط |
| `test` | اختبارات |

---

## 10. أسئلة شائعة — FAQ

**Q: أين أضع منطق مشترك بين featureين؟**
A: إذا feature واحدة → داخلها. إذا featureان → انتظر الثالثة ثم انقل لـ `components/features/` root أو `lib/`.

**Q: هل أستطيع تعديل shadcn primitives؟**
A: لا. الـ primitives موجودة في `@deqah/ui` (workspace package). إذا احتجت تعديلاً → عدّلها داخل `packages/ui/src/primitives/` لتظل مشتركة بين dashboard/admin/website. `components/ui/` في الـ dashboard للـ wrappers المحلية فقط (date-picker, nationality-select).

**Q: أين أحفظ constants؟**
A: في `lib/types/[feature].ts` كـ `const` عادية، أو `lib/utils.ts` إذا كانت عامة.

**Q: متى أستخدم `useMemo`؟**
A: لأي computed value داخل hook يُحسب من `data` — خاصة الـ filters، aggregates، والـ derived state.

**Q: الـ staleTime المناسب؟**
A: 5 دقائق للـ lists، 10 دقائق للـ details، 30 دقيقة للـ config/settings.
