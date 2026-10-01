# عرض أسعار الباقات شاملة الضريبة — 2026-10-02

## النطاق

ضمن PR [tariiq222/sawaa#133](https://github.com/tariiq222/sawaa/pull/133) (تطبيق إعداد الضريبة على مشتريات الباقات). أصبحت فاتورة الباقة ومبلغ Moyasar يضيفان الضريبة فوق السعر الصافي عند تفعيلها من الإعدادات؛ القيمة الحالية في الإنتاج صفر.

تغييرات الجوال:

- `lib/package-vat.ts` (جديد): قراءة `vatRate` من عائلة الباقة (المفقود أو غير الصالح = 0)، وحساب الضريبة `round_half_up(net × rate)` بالهللة مطابقًا لـ`computeVat` في الخادم، و`totalCharged ?? amountPaid` لصفوف المشتريات.
- `services/client/packages.ts` و`hooks/queries/usePackages.ts`: أنواع تضيف `vatRate` للعائلة و`vatAmount`/`totalCharged` لصف الشراء.
- `PackageCard`، `app/(client)/packages/[id].tsx`، `app/public-detail/[kind]/[id].tsx`: السعر المعروض شامل الضريبة، مع «شامل الضريبة» وسطر تفصيل الصافي والضريبة عند تفعيلها.
- `app/(client)/packages/purchases.tsx`: يعرض المبلغ المدفوع فعلًا (`totalCharged`) مع الرجوع إلى `amountPaid` للاستجابات القديمة.
- `i18n/ar.json` و`i18n/en.json`: مفتاحا `packages.vatIncluded` و`packages.vatBreakdown`. لا توجد نسبة مكتوبة في الكود.

عند `vatRate = 0` أو غيابه تبقى جميع الشاشات كما كانت.

## حالة Git

- الفرع `claude/package-vat`، لم يُدمج بعد. لا بناء EAS ولا رفع TestFlight لهذا التغيير.

## التحقق وحدوده

- `pnpm --dir apps/mobile typecheck`: ناجح.
- `pnpm --dir apps/mobile lint`: صفر أخطاء و5 تحذيرات في ملفات لم تتغير.
- الاختبارات المعدلة والجديدة (`lib/__tests__/package-vat.test.ts`، `PackageCard.test.tsx`، `package-ui.test.tsx`، `guest-booking.test.tsx`): 44 اختبارًا ناجحًا، تشمل `vatRate` صفر و0.15 (36000 → 41400 هللة) وحالات التقريب.
- التشغيل الكامل `pnpm --dir apps/mobile test --runInBand`: 1001 اختبارًا ناجحًا؛ فشلت 3 مجموعات إضافات iOS في التحميل محليًا لغياب الوحدة `uuid` في `node_modules/.pnpm` (مشكلة تثبيت محلية لا تمس التغيير).
- **غير متحقق:** لم يُشغَّل التطبيق على محاكٍ أو جهاز، ولم يُجرَّب شراء باقة مع ضريبة مفعّلة عبر Moyasar sandbox.
