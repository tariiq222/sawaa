# مراجعة التنبيهات والعربية — 2026-09-28

## متابعة التجميع قبل TestFlight — 2026-09-28

- بناءً على طلب المالك، حُفظت إصلاحات comms/dashboard/website/mobile في commits منفصلة ضمن PR100 إلى develop؛ لا backend production أو main promotion.
- أغلق التحقق الجديد قيود generated Prisma/typecheck والمجموعة الكاملة: backend852 suites/7944 tests passed (واحد skipped)، dashboard274 files/2170 passed، typecheck/lint/parity ناجحة، Chromium toast40 ناجحة.
- **smoke41 passed /1 skipped** ضد production build للداشبورد والخادم المعاد بناؤه على قاعدة QA اصطناعية55228. أول إعادة فشلت429؛ الثانية استخدمت `THROTTLER_DISABLED=true` الموجود في إعدادات الاختبار غير الإنتاجي فقط دون تغيير حارس أو سياسة الإنتاج. التقرير السابق أدناه يبقى سجلًا تاريخيًا ولا يمثل حالة البوابة الأخيرة.
- لم يثبت التسليم الخارجي SMS/Push/Email أو قبول جهاز فعلي؛ لا تتغير هذه الحدود بنجاح smoke.

## النتيجة وحدود القبول (المراجعة السابقة)

أُصلحت عيوب مثبتة في المكوّنات المشتركة وشاشات الإشعارات ومحتوى رسائل الخادم. **القبول الشامل لجميع التنبيهات غير مكتمل**: لا تحقق أصلي على جهاز جوال، لا تسليم SMS/Push/Email حقيقي، واختبار dashboard smoke غير ناجح. لم يحدث commit أو push أو نشر. الفرع عند الفحص `develop`، ‏HEAD `1a1838583`؛ توجد تعديلات مستخدم متزامنة خارج هذا العمل لم تُنسب إليه.

## الإصلاحات

- Dashboard: تسمية عربية لجرس الإشعارات ومنطقة Toast، اتجاه حيّ يتبع تبديل اللغة، وإدخال Toaster ضمن ThemeProvider. عرض نص الإشعار الكامل في صفحة التفاصيل بدل قصه، واسم عام مترجم للأنواع غير المعروفة، وخطأ تحميل مع إعادة المحاولة بدل حالة فارغة مضللة.
- Toast CSS: إزالة تعارض position/hover transform مع إدارة Sonner للتكديس، ضبط العرض حسب الحاوية، التفاف النص العربي والروابط والأزرار دون قص أو تداخل.
- Mobile: RTL/LTR صريح للنصوص، فصل التحميل والخطأ والفراغ، تصريف عدد الإشعارات العربية، تحسين زر تحديد الكل كمقروء ووصف حالة القراءة. إصلاح NotificationItem المشترك أيضًا، مع أنه لا يملك مستخدم إنتاج حاليًا.
- Website: تحسين احتواء والتفاف مكوّن AccountLoadError المشترك بالعربية والإنجليزية. لا يوجد نظام Toast أصلًا في الموقع؛ لم يُضف واحد.
- Backend comms: مصطلح «موعد» في رسائل إلغاء العميل في المسارين، `dir="rtl" lang="ar"` لغلاف بريد blocks، وتحديد BUSINESS_TZ (Asia/Riyadh) لتوقيت التذكير في المسارين. لا تغيير عقد API أو صلاحيات أو مدفوعات أو تشفير أو organizationId.

## دليل الاختبارات

| السطح | قبل الإصلاح | بعد الإصلاح | الحدود |
|---|---|---|---|
| Dashboard components | 4 عيوب إشعارات + اختبار ترجمة Toast فاشلة | 14 اختبارًا /4 ملفات ناجحة | DOM، لا قراءة شاشة فعلية |
| Toast Chromium | زر الإجراء غير قابل للنقر خارج viewport مع التنسيق السابق | 40 حالة ناجحة: RTL/LTR × عرض 320/375/768/1440 × success/error/warning/info/loading | مكوّنات إنتاج معزولة في متصفح حقيقي، ليست تجربة التطبيق كاملًا؛ لا 200% zoom أو OS screen reader |
| Website | 3 حالات انحدار فاشلة | 14 اختبارًا /ملفين ناجحين | JSDOM فقط |
| Mobile | 12 فاشلًا/1 ناجح | 48 اختبارًا /7 مجموعات ناجحة | native rendering/OS push غير متحقق |
| Backend comms | 7 فاشلة/34 ناجحة | 41 اختبارًا /5 مجموعات ناجحة | dependencies وهمية؛ اختبار التوقيت يحاكي default UTC/New_York مع Intl الحقيقي |

أوامر dashboard المركزة:

```sh
pnpm --dir apps/dashboard exec vitest run test/unit/components/app-toaster.spec.tsx test/unit/features/notifications/notification-arabic.spec.tsx test/unit/features/notifications/notification-card.spec.tsx test/unit/lib/format-notification-body.spec.ts
node apps/dashboard/scripts/verify-toast-layout.mjs
pnpm --filter=dashboard typecheck
pnpm --filter=dashboard i18n:verify
```

كل الأوامر أعلاه ناجحة. ESLint لملفات dashboard المعدلة والاختبارات والسكربت ناجح. Website: typecheck وESLint للملفين ناجحان. Mobile typecheck ناجح. `git diff --check` ناجح. تفاصيل أوامر الجوال في `docs/mobile-app/releases/2026-09-28.md`.

أمر backend الناجح:

```sh
pnpm --filter=backend exec jest --runInBand --runTestsByPath src/modules/comms/events/on-booking-cancelled.handler.spec.ts src/modules/comms/events/on-booking-reminder.handler.spec.ts src/modules/comms/email-templates/render-blocks.spec.ts src/modules/comms/notification-outbox/materialize-notification-intent.handler.spec.ts src/modules/comms/notification-outbox/notification-email-renderer.spec.ts
```

### فحوص لم تنجح/لم تكتمل

- `pnpm --filter=dashboard run e2e:smoke`: 10 ناجحة، 31 فاشلة، 1 متخطاة؛ الأخطاء المسجلة HTTP 429 في تسجيل دخول بيئة الاختبار. لم تُعدّل حماية الدخول ولم يُدّع نجاح هذا الاختبار. ظهرت تحذيرات Edge Runtime سابقة من middleware/Frontman.
- Backend typecheck: 21 diagnostic خارج comms تخص generated Prisma للفئات وبطاقات الرئيسية؛ لا أخطاء متبقية في ملفات هذه المراجعة. لم يتم توليد Prisma أو تعديل مصادر غير مرتبطة لإخفاء القيد.
- أمر dashboard الأول باستخدام `test -- path` شغّل المجموعة كاملة بدل التصفية وانتهى بمهلة 200 ثانية؛ لا يعد نجاحًا كاملًا. أعيدت الاختبارات المستهدفة عبر `exec vitest run path` بنجاح.
- لا نسبة تغطية جديدة ولا ادعاء نجاح الاختبارات الكاملة لجميع التطبيقات.

## ما بقي للتحقق

1. إعادة smoke في بيئة اختبار لا يعيقها rate limit ثم تجربة قائمة الإشعارات الحية.
2. معاينة شاشة الجوال وNative Alert وPush على iOS/Android مع نص عربي طويل وDynamic Type وVoiceOver/TalkBack. توجد native alerts متفرقة خارج نطاق الإصلاح، منها رسائل خطأ خام من query-client؛ لا اعتماد شامل لها.
3. معاينة البريد في عميل بريد آمن وتجربة التسليم بإذن صريح. هذه الإصلاحات لا تعيد كتابة التنبيهات القديمة أو outbox المجمد أو HTML القوالب المخزنة سابقًا.

## مراجعة ذاتية

| المحور | التقييم | الدليل/التحسين |
|---|---|---|
| الدقة | 4/5 | اختبارات قبل/بعد وقياس Chromium؛ لا تسليم حقيقي مثبت |
| الاكتمال | 3/5 | الإصلاحات المثبتة موجودة، لكن الجهاز وsmoke والتسليم ما زالت غير مقبولة نهائيًا |
| الوضوح | 4/5 | فصل نجاح الاختبارات المحدودة عن القيود؛ تقرير تقني أطول من الملخص الموجه للمستخدم |
| قابلية التنفيذ | 4/5 | أوامر قابلة للإعادة؛ يلزم إعداد تحقق smoke وبيئة جهاز |
| الإيجاز | 4/5 | التفاصيل هنا، مع ملخص عربي أقصر للمستخدم |

المتوسط 3.8/5. التحسين الأعلى أثرًا هو استكمال التحقق الحي لا إضافة تعديلات تجميلية أخرى. التقييم لا يساوي موافقة نهائية على جميع التنبيهات.
