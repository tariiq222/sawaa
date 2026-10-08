# نسخة iOS حديثة إلى TestFlight — 2026-10-08 — البناء 27

الحالة النهائية: **1.0.0 (27) متاح في TestFlight ضمن Sawaa Internal**. EAS FINISHED وApple VALID وIN_BETA_TESTING؛ المجموعة تضم مختبرًا واحدًا. حُفظت ملاحظات الاختبار العربية وإقرار التشفير، وتحقق بقاؤهما مع المجموعة بعد إعادة تحميل الصفحة.

EAS build ID: `9fac2f83-68ae-49ce-82eb-be18cf42c6ed`؛ انتهى البناء عند `2026-10-08T10:47:58.691Z`.

Apple delivery UUID: `7f9d8dfc-18a8-4c1c-a43e-53eb231b433b`. IPA SHA256: `0df9beddb26d2ca45e7b6d045084b60d30cec8f079fa3a8f91317981e701e60c`.

[صفحة البناء لدى Apple](https://appstoreconnect.apple.com/apps/6815632181/testflight/ios/7f9d8dfc-18a8-4c1c-a43e-53eb231b433b) و[EAS](https://expo.dev/accounts/tariq222/projects/sawa/builds/9fac2f83-68ae-49ce-82eb-be18cf42c6ed).

طلب المالك بناء نسخة حديثة على TestFlight. المصدر `develop` عند `5855a2bdc081ac27f9763f795899275167628756` مطابق للفرع البعيد، وكانت الشجرة نظيفة قبل إعداد البناء. يجمع الواجهات الحديثة وإصلاحات الدفع المدمجة، ومنها Apple Pay المباشر، وانتظار نتيجة المزود واستئناف الحجز، وتوحيد مسار تسجيل زر Apple Pay. لم يجرِ تغيير سلوك التطبيق ضمن مهمة التسليم هذه.

## التحقق والإعداد

- نجح `pnpm --dir apps/mobile typecheck` و`pnpm --dir apps/mobile lint`.
- نجح `pnpm --dir apps/mobile test --runInBand --forceExit`: 224 مجموعة و1634 اختبارًا؛ استُخدم forceExit بعد اكتمال الاختبارات، فلا يثبت تنظيف جميع مؤقتات بيئة Jest.
- نجح تصدير Metro الإنتاجي وفحص sourcemap: تسجيل واحد لـPKPaymentButton من مسار SDK `src`.
- اختير API الاستيج `https://staging.sawaa.sa/api/v1`، ونجح فحص رفض العنوان المفقود وlocalhost في release. استجاب health/ready بالرمز 200.
- ملف توقيع Apple حديث ACTIVE وصالح حتى 2027-09-24، مع merchant `merchant.sa.sawa.app` وteam/bundle الصحيحين.
- profile مؤقت `testflight-staging` يمتد من production مع قناة staging وAPI الصريح؛ استخدام EAS environment production لتوفير Firebase الموجود. لم تُعدّل متغيرات الحساب. حُفظت credentials المحلية الموجودة لاستعادتها بعد إرسال الأرشيف.
- فُحص build:inspect وطابقت الملفات المقصودة بصمات manifest، مع استبعاد الأسرار وملفات البيئة الفعلية وcredentials وprivate-config.
- فُحص IPA: ZIP وcodesign strict، bundle/version/build/team، `get-task-allow=false`، push=production، Apple Pay merchant والشهادة وprofile مطابقة، SDK iphoneos26.2. API الاستيج موجود وAPI الإنتاج غائب، والخلفيتان وخمسة أوزان IBM وPassKit موجودة. ملف `.app` استُخرج من IPA نفسه.
- أُعيد eas.json وcredentials المحلية الأصلية بعد رفع الأرشيف، وتحققت مطابقة 731 ملفًا للمصدر والأرشيف مع استثناء overlay الموثق. شجرة apps/mobile وpackages/shared نظيفة.
- Apple API أكد VALID وIN_BETA_TESTING و`usesNonExemptEncryption=false` والملاحظات المطابقة. حُفظ إقرار التشفير عبر جلسة المالك وفق القرار السابق وعدم إضافة تشفير جديد، ثم أُضيفت Sawaa Internal عبر الواجهة وتحقق بقاء المجموعة ومختبرها الواحد بعد إعادة التحميل. استعلام علاقة betaGroups بالمفتاح المقيد أعاد403؛ دليل المجموعة من واجهة الحساب، دون تغيير المفتاح أو صلاحياته.

الأدلة الخاصة: `/Users/tariq/.codex/release-evidence/2026-10-08-latest-testflight/`، وتشمل source-manifest.json وvalidation.json وapple-pay-graph.json وسجلات EAS. لا تُدرج مفاتيح أو روابط التنزيل المؤقتة في Git.

إثبات الواجهة: `/Users/tariq/.codex/visualizations/2026/10/08/01a11b10-9bf9-7c92-8ba1-5c4080db9d95/testflight-build27.jpg`؛ إثبات القبول المنقح في `acceptance.json` ضمن مجلد الأدلة الخاصة.

## حدود التحقق

اختبار الجهاز الفعلي وApple Pay/Moyasar وdashboard smoke لهذه النسخة غير متحقق ضمن هذه المهمة. الاختبارات السابقة للبناء المحلي25.5 لا تُنسب إلى البناء27. لا commit أو push أو merge أو نشر backend/production أو إرسال App Review ضمن الطلب.

القياس وفق sol61-all-v1: المنسق GPT-6.1 Sol بجهد high، دون وكلاء. بدأ baseline متأخرًا؛ إجمالي استهلاك المهمة غير معلوم.
