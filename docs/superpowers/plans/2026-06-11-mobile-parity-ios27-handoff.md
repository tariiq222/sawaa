# تسليم: مطابقة تطبيق الجوال + iOS 27 — المهام المتبقية (9–13)

> **للوكيل المنفّذ:** هذا الملف يسلّمك تنفيذاً جارياً. المرجع الكامل لنصوص المهام هو ملف الخطة:
> `docs/superpowers/plans/2026-06-11-mobile-parity-ios27.md` — نفّذ منه **المهام 9 و 10 و 11 و 12 و 13 بالترتيب**، مع التعديلات المذكورة أدناه.
> المواصفة المعتمدة: `docs/superpowers/specs/2026-06-11-mobile-parity-ios27-design.md`

## حالة التنفيذ الحالية

- **الفرع:** `feature/mobile-parity-ios27` (من main المحلي). **لا push إطلاقاً** — الدفع إلى main ينشر إنتاجاً تلقائياً، والدمج قرار المالك.
- **شجرة العمل فيها تغييرات غير مرتبطة وغير مكوّمتة** (apps/backend/package.json، صفحات website، seeds). **لا تلمسها ولا تعمل `git add -A` أبداً** — كل كوميت يرحّل ملفات مهمته فقط.

### المهام المنجزة (لا تُعاد)

| مهمة | كوميت | ملخص |
|---|---|---|
| 1 | b2146ca | تثبيت expo-glass-effect@~55.0.11 + expo-symbols@~55.0.9 |
| 2 | d61e051 | نقل notifications/profile من (tabs) إلى (client)/ + تحديث المراجع |
| 3 | eb22580 | NativeTabs بدل GlassTabBar (حُذف الملف) — تبويبات زجاج أصلية |
| 4 | 4525c0a | GlassView الأصلي في Glass.tsx + GlassSurface.tsx مع fallback كامل |
| 4b | b636588 | components/ui/AppIcon.tsx (SF/Lucide) + concentricRadius في tokens |
| 5 | 6a5b430 | الخط: 300–600 → خط النظام (مع fontWeight بكل المواضع، 31 ملف)، 700/900 → Handicrafts؛ ThemedText محدّث |
| 6 | f942448 + eccf904 | الوضع الداكن: ThemeProvider (system/light/dark + AsyncStorage 'sawaa.themeMode') + darkColorOverrides في tokens + مفتاح settings + اختبار. eccf904 أصلح type regression في pickExisting |
| 7 | 149ce18 | findDepartment → packages/shared/catalog (export ./catalog + index + tsconfig)؛ الموقع يعيد التصدير؛ vitest.config.ts أُعيد ترتيب الـ aliases |
| 8 | 199ed96 | services/client/catalog.ts: تصدير PublicCatalogRaw/Category/DepartmentRow + getCatalog() |

كل ما سبق مرّ بمراجعة مطابقة مستقلة + typecheck (exit 0) + اختبارات الموبايل (110/110) واختبارات الموقع (212/212).

## بروتوكول التنفيذ للمهام المتبقية

1. لكل مهمة: نفّذ نص المهمة من ملف الخطة حرفياً (الخطوات فيها كود كامل وأوامر تحقق).
2. بعد كل مهمة: `pnpm --dir apps/mobile typecheck` يجب أن يخرج **exit 0 فعلياً** — شغّل الأمر ولا تدّعي. (درس من المهمة 6: منفّذ ادّعى أن أخطاء typecheck "قديمة" وكانت من تعديله).
3. كوميت لكل مهمة بالرسالة المحددة في الخطة + سطر `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
4. اختبارات الموبايل Jest: `pnpm --dir apps/mobile test` — كلها تمر قبل الكوميت.
5. قواعد الموبايل: لا `any`، لا ألوان hex في المكوّنات (توكنات فقط)، لا نصوص صلبة (i18n)، start/end لا left/right، حد 350 سطراً للملف.

## المهام المتبقية + تعديلات على نص الخطة

### المهمة 9 — المعالجون: isBookable + serviceIds
نص الخطة كما هو، مع **تعديل واحد**: خطوة التحقق بـ curl تتطلب باك إند شغّال. إن لم يكن شغالاً، تحقق من وجود الحقلين في **مصدر الباك إند** بدلاً منه: اقرأ handler/DTO قائمة الموظفين العامة في `apps/backend/src/api/public/` (ابحث: `grep -rn "isBookable\|serviceIds" apps/backend/src/api/public apps/backend/src/modules --include="*.ts" | head`). إن لم يرجع الباك إند الحقلين فعلاً — توقف وأبلغ، لا تخترع.

### المهمة 10 — العيادات الحقيقية
نص الخطة كما هو (اختبار deriveClinics أولاً TDD، ثم lib/clinics.ts، useClinics، FeaturedClinics ببيانات حقيقية، شاشة clinics.tsx، فلتر clinicId في therapists.tsx، مفاتيح i18n). **إضافات ملزمة:**
- استخدم `AppIcon` من `components/ui/AppIcon.tsx` للأيقونات الجديدة، و`concentricRadius` من `theme/sawaa/tokens.ts` للعناصر المدوّرة المتداخلة.
- ملاحظة قائمة من المهمة 4b: أيقونة Star في FeaturedClinics بقيت Lucide بسبب prop الـ fill — عند إعادة كتابة الملف أبقها Lucide أو استخدم `sf="star.fill"` بدون fill (الرمز ممتلئ أصلاً).
- النصوص عبر ThemedText أو fNNN + fontWeight مرافق (نمط المهمة 5).

### المهمة 11 — خدمة الجلسات الجماعية + hooks
نص الخطة كما هو (اختبار الخدمة أولاً بنمط mock من `services/client/payments.test.ts`، ثم group-sessions.ts بدالة unwrap المتسامحة، ثم useGroupSessions hooks). الـ endpoints عامة وتوكن التطبيق Bearer مقبول في `POST /public/bookings/group-sessions/:id/book` (متحقق منه — ClientSessionGuard يقرأ التوكن من الهيدر).

### المهمة 12 — شاشات المجموعات + قسم الرئيسية الحقيقي
نص الخطة كما هو. **تذكيرات ملزمة:**
- الأسعار **هللات**: اعرض `price / 100` مع رمز الريال من `home.sar`. اقرأ `apps/website/features/support-groups/support-group-card.tsx` قبل بناء البطاقات وطابق دلالات العرض.
- التاريخ: `Intl.DateTimeFormat` مع `calendar: 'gregory'` للعربي.
- الحالات: isFull && waitlistEnabled → قائمة انتظار؛ isFull && !waitlistEnabled → مكتمل (زر معطّل)؛ غير ذلك → انضم + spotsLeft.
- استخدم AppIcon + concentricRadius هنا أيضاً.
- التحقق اليدوي يحتاج: `pnpm docker:up` ثم `pnpm --filter=backend run seed:group-programs` ثم `pnpm dev:backend`.

### المهمة 13 — الفحص النهائي
نص الخطة كما هو: typecheck للموبايل + test للموبايل + `pnpm typecheck` من الجذر + `pnpm --filter=@sawaa/website test` + `pnpm --filter=@sawaa/shared build`، ثم مصفوفة الفحص اليدوي على محاكي iOS 26+ (موجودة في الخطة). أبلغ النتائج بصدق — أي فشل يُذكر لا يُتجاوز.

## بعد إنهاء كل المهام

- مراجعة نهائية للتنفيذ كاملاً (diff الفرع عن main) قبل عرضه على المالك.
- **لا دمج في main ولا push** — المالك يقرر (الدفع ينشر إنتاجاً).
- نقاط فحص بصري مؤجلة للمحاكي: غياب الحد الأبيض على الزجاج الأصلي (مقصود — حواف النظام)، شكل التبويبات الأصلية بالعربي RTL، الوضع الداكن على الشاشات ذات الألوان الثابتة (قصور معروف ومقبول بالمواصفة).
