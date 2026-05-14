# Deqah Dashboard

لوحة تحكم منصة إدارة العيادات الذكية — Deqah by WebVue Technology Solutions.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **UI:** shadcn/ui + Tailwind CSS v4
- **State:** TanStack Query v5
- **Forms:** React Hook Form + Zod
- **Icons:** Hugeicons React
- **Tables:** TanStack Table v8
- **i18n:** next-intl (Arabic + English, RTL-first)

---

## Quick Start

```bash
npm install
npm run dev
```

| الأمر | الوظيفة |
| ----- | ------- |
| `npm run dev` | بيئة التطوير على port 5103 |
| `npm run build` | بناء production |
| `npm run typecheck` | فحص TypeScript |
| `npm run lint` | فحص القواعد المعمارية |
| `npm run format` | تنسيق الكود |

---

## وثائق المشروع — Docs

> **ابدأ من هنا** قبل كتابة أي كود:

| الملف | اقرأه عند |
| ----- | --------- |
| **[CLAUDE.md](./CLAUDE.md)** | قواعد التطوير الكاملة (Layer rules, i18n, billing, terminology) |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | أول مرة تعمل على المشروع |
| **[DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)** | قبل كتابة أي UI |
| **[tokens.md](./tokens.md)** | مرجع الـ design tokens |
| **[CODEOWNERS](./CODEOWNERS)** | لمعرفة من يراجع ماذا |
| **[docs/refactor-roadmap.md](./docs/refactor-roadmap.md)** | جدول الصيانة الدوري |

---

## هيكل الكود — Structure

```text
app/(dashboard)/[feature]/    ← Pages (orchestration only)
components/features/[feature]/ ← Feature UI components
components/ui/                 ← App-local wrappers only (date-picker, nationality-select)
@deqah/ui                    ← shadcn primitives (workspace package — لا تُعدَّل)
hooks/                         ← TanStack Query hooks
lib/api/                       ← Network calls
lib/types/                     ← TypeScript types
lib/schemas/                   ← Zod validation
lib/translations/              ← i18n strings (ar + en)
```

قاعدة الاستيراد: `app → components → hooks → lib` (أحادي الاتجاه)

---

## Features

| المجموعة | الـ Features |
| --------- | ----------- |
| Clinical Core | bookings, clients, employees |
| Financial | payments, invoices, coupons |
| Catalog | services, branches, categories, departments, intake-forms |
| Config | settings (incl. billing, sms), branding, content |
| Users | users |
| AI & Comms | chatbot, contact-messages, notifications |
| Operations | reports, ratings, activity-log |
