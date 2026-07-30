# مركز سواء للاستشارات الأسرية

> نظام حجوزات وإدارة مخصص لمركز سواء للاستشارات الأسرية والنفسية.

---

## المكونات

| المكون | التقنية | الوصف |
|--------|---------|-------|
| **Backend** | NestJS 11 + Prisma 7 + PostgreSQL 16 | واجهة برمجة التطبيقات والمنطق التجاري |
| **Dashboard** | Next.js 15 + React 19 | لوحة تحكم الموظفين والمستشارين |
| **Website** | Next.js 15 (App Router) | الموقع الإلكتروني للحجز والمعلومات |
| **Mobile** | Expo SDK 55 + React Native 0.83 | تطبيق العميل والموظف (iOS + Android) |

## الحزم المشتركة (packages/)

| الحزمة | الوصف |
|--------|-------|
| `@sawaa/shared` | Types + Zod schemas مشتركة بين كل التطبيقات |
| `@sawaa/api-client` | HTTP client مكتوب يدوياً (ليس مولّد) — يُستهلك من dashboard + website |
| `@sawaa/ui` | shadcn primitives — للـ dashboard فقط اليوم |
| `@sawaa/test-helpers-pw` | Playwright helpers للـ dashboard e2e |
| `@sawaa/website` | اسم الحزمة الموروث (لا تُعدّل) |

---

## المتطلبات

- Node.js 20+
- pnpm 10+
- Docker & Docker Compose

---

## التشغيل المحلي

```bash
# 1. تشغيل الخدمات الأساسية (Postgres, Redis, MinIO)
pnpm docker:up

# 2. تثبيت الاعتمادات
pnpm install

# 3. تطبيق migrations وإنشاء البيانات الأولية
pnpm db:reset

# 4. تشغيل التطبيقات
pnpm dev:backend    # ← terminal 1
pnpm dev:dashboard  # ← terminal 2
pnpm dev:website    # ← terminal 3
```

الخدمات (في وضع التطوير):
- Backend:   http://localhost:5200
- Dashboard: http://localhost:5203
- Website:   http://localhost:5205

في Docker production تُستخدم المنافذ الداخلية `5100/5103/5105` (موثّقة في `docs/DOKPLOY-SETUP.md`).

---

## الميزات

### أنواع الجلسات
- **فردية** — جلسة استشارية فردية
- **زوجية** — جلسة استشارية للزوجين
- **أسرية** — جلسة تشمل أفراد الأسرة
- **جماعية** — جلسات دعم جماعية
- **عن بُعد** — جلسات عبر Zoom

### ملف المراجع
- معلومات شخصية وتcontact
- الحالة الاجتماعية والتعليمية
- السجل الطبي والنفسي
- الأدوية الحالية
- تقييم المخاطر (أفكار انتحارية / إيذاء ذاتي)

### خطط العلاج
- أهداف علاجية محددة
- جلسات متسلسلة مع ملاحظات SOAP
- تتبع التقدم
- واجبات منزلية

---

## البنية التقنية

### Backend
- **نظام لمركز واحد** — يخدم مركز سواء فقط، بلا تبديل منظمات ولا تصفية حسب المنظمة
- **Prisma schema** — تمت إزالة جداول التعدد المؤسسي (Organization, Membership, Subscription, Plan, Billing)

### Database Schema
- تم الاحتفاظ بـ `organizationId` في الجداول للتوافق، لكن جميعها تشير إلى نفس المنظمة
- جداول جديدة: `TreatmentPlan`, `SessionNote`

---

## التخصيص

```bash
# توليد Prisma client بعد أي تعديل على المخطط
cd apps/backend && npm run prisma:generate

# إنشاء migration جديد (يُلتزم به — لا تُعدَّل migrations قديمة)
cd apps/backend && npm run prisma:migrate

# تصدير OpenAPI snapshot + تجديد الـ dashboard types
pnpm openapi:sync
```

## وثائق إضافية

- [`CLAUDE.md`](./CLAUDE.md) — القواعد الكاملة، single-tenant invariants، security tiers، definition of done
- [`docs/`](./docs/) — أدلة النشر، ADRs، runbooks، نتائج تدقيق

---

## البيئات

| البيئة | URL |
|--------|-----|
| التطوير | http://localhost:5200 (backend) |
| الإنتاج | https://api.sawaa.sa |

---

## الترخيص

خاص — مركز سواء للاستشارات الأسرية
