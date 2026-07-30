# Sawaa Dashboard

لوحة تحكم منصة إدارة العيادات الذكية — Sawaa by WebVue Technology Solutions.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **UI:** shadcn/ui + Tailwind CSS v4 (via `@sawaa/ui` workspace package)
- **State:** TanStack Query v5
- **Forms:** React Hook Form + Zod
- **Icons:** Hugeicons React
- **Tables:** TanStack Table v8
- **i18n:** custom runtime (Arabic + English, RTL-first) — `next-intl` installed but unused at runtime

---

## Quick Start

```bash
npm install
npm run dev
```

| الأمر | الوظيفة |
| ----- | ------- |
| `npm run dev` | بيئة التطوير على port **5203** (Turbopack) — Docker production uses 5103 |
| `npm run build` | بناء production |
| `npm run typecheck` | فحص TypeScript |
| `npm run lint` | فحص القواعد المعمارية |
| `npm run format` | تنسيق الكود |
| `npm run i18n:verify` | فحص تطابق AR/EN keys |
| `npm run test` | Vitest |

---

## وثائق المشروع — Docs

> **ابدأ من هنا** قبل كتابة أي كود:

| الملف | اقرأه عند |
| ----- | --------- |
| **[CLAUDE.md](./CLAUDE.md)** | قواعد التطوير الكاملة (Layer rules, i18n, billing, terminology) |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | أول مرة تعمل على المشروع |
| **[tokens.md](./tokens.md)** | مرجع الـ design tokens (الألوان، spacing، shadows…) |
| **[@sawaa/ui/CLAUDE.md](../../packages/ui/CLAUDE.md)** | قبل استخدام أو تعديل أي UI primitive |

---

## هيكل الكود — Structure

```text
app/(dashboard)/[feature]/    ← Pages (orchestration only)
components/features/[feature]/ ← Feature UI components
components/ui/                 ← App-local wrappers only (date-picker, nationality-select)
@sawaa/ui                    ← shadcn primitives (workspace package — لا تُعدَّل)
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