# مركز سواء للاستشارات الأسرية

> نظام حجوزات وإدارة مخصص لمركز سواء للاستشارات الأسرية والنفسية.

---

## المكونات

| المكون | التقنية | الوصف |
|--------|---------|-------|
| **Backend** | NestJS 11 + Prisma 7 + PostgreSQL 16 | واجهة برمجة التطبيقات والمنطق التجاري |
| **Dashboard** | Next.js 15 + React 19 | لوحة تحكم الموظفين والمستشارين |
| **Website** | Next.js 15 (App Router) | الموقع الإلكتروني للحجز والمعلومات |

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

الخدمات:
- Backend:   http://localhost:5200
- Dashboard: http://localhost:5203
- Website:   http://localhost:5205

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
cd apps/backend && pnpm prisma:generate

# إنشاء migration جديد
cd apps/backend && pnpm prisma:migrate

# تصدير OpenAPI spec
pnpm openapi:sync
```

---

## البيئات

| البيئة | URL |
|--------|-----|
| التطوير | http://localhost:5200 (backend) |
| الإنتاج | https://api.sawaa.sa |

---

## الترخيص

خاص — مركز سواء للاستشارات الأسرية
