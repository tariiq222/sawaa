# TestFlight 1.0.0 (34) — توحيد الدخول — 2026-10-09

الحالة النهائية: **1.0.0 (34) متاح في TestFlight ضمن Sawaa Internal**؛ Apple `VALID` و`IN_BETA_TESTING`، متصل بالاستيج. تحقق الحفظ بعد إعادة فتح الصفحة في9أكتوبر2026 نحو17:27بتوقيت الرياض.

## المصدر والنطاق

مصدر مجمد من `origin/develop` عند `9ab27b465af36816f0f40564ead06c5679ee4803`، يشمل PR184 وتصحيح توحيد دخول العملاء والموظفين بالجوال أو البريد، مع إزالة رابط دخول الموظفين المنفصل. التسجيل العام يبقى للعملاء فقط، ويحدد الخادم نوع الجلسة ووجهتها بعد التحقق. يشمل جميع تغييرات البناء32 السابقة.

صُدّر المصدر إلى مساحة خاصة باستخدام git archive. الإعداد المؤقت `testflight-staging` يستخدم قناة staging وعنوان `https://staging.sawaa.sa/api/v1` وmerchant الموجود والتوقيع المحلي. أُعيد استخدام الرقم34 المحجوز في EAS بعد التحقق من غيابه لدى Apple وعدم وجود بناء نشط؛ autoIncrement=false في الإعداد المعزول فقط. لا محاولة حصة سحابية أو تغيير خطة الحساب. بعد البناء أُعيد eas.json وأُزيل مرجع credentials من المرشح. لم تتغير إعدادات checkout الأصلي أو أعماله الأخرى، ولم يُنفذ commit أو push أو merge أو نشر خادم في هذه الجولة.

## الفحوص

- frozen lockfiles وبناء shared: نجاح.
- mobile typecheck وlint: خروج0.
- mobile Jest الكامل مع coverage وrunInBand وforceExit: **232 مجموعة / 1713 اختبارًا** ناجحًا. forceExit لا يثبت غياب open handles.
- طابق أرشيف البناء وبناء EAS المحلي الفعلي بصمات **772 ملفًا**؛ الأسرار وcredentials خارج الأرشيف، ووحدة SawaaPayments الأصلية موجودة. مصدر PhoneStepForm لا يحتوي رابط الموظفين المنفصل.
- ملف Apple provisioning: ACTIVE حتى2027-09-24. التوقيع داخل IPA يطابق الملف الحالي وشهاداته، مع صلاحية merchant.sa.sawa.app.
- بناء EAS محلي ناجح، Xcode27.0 / Fastlane2.240.1 / CocoaPods1.17.0. `expo-doctor` يحتفظ بالملاحظتين المعروفتين عن expo-modules-core المباشر وexpo-updates55.0.31 مقابل~55.0.33؛ لم تُغيّر الاعتماديات أو يُعطّل الفحص.
- ZIP وcodesign strict ناجحان؛ `sa.sawa.app` / `1.0.0 (34)` / الفريق569M49FYA6، get-task-allow=false وpush production وmerchant الصحيح. SDK: iphoneos27.0.
- الحزمة تحتوي عنوان الاستيج وتستبعد عناوين API الإنتاج، وتضم عقود الدخول بالجوال والتحقق من البريد والجوال وPassKit والخطوط والخلفيات. source map الناتج عن البناء يثبت تسجيل PKPaymentButton واحدًا.
- health الاستيج HTTP200؛ ليس قبولًا وظيفيًا لمسارات الدخول أو المزودين.

IPA SHA256: `6fbdb8bfbdc5b1bea47c519102dd47346d99f363ea41589cda6e4bdda0745fad`.

## تسليم Apple

نجح altool بخروج0. معرف التسليم: `e007e70c-a0be-4dff-93e1-baab54e84dc1`. لا EAS cloud build ID لهذا البناء المحلي.

ظهر البناء في Apple بتاريخ9أكتوبر2026 الساعة17:23بتوقيت الرياض، واكتملت معالجته إلى VALID. حُفظ إقرار التشفير وفق إجابة المالك السابقة `None of the algorithms mentioned above` دون تغيير مكتبات التشفير؛ API أثبت usesNonExemptEncryption=false. حُفظت ملاحظات الاختبار بالعربية ar-SA وطابقها استعلام API. أُضيف البناء إلى Sawaa Internal بمختبر واحد؛ بعد إعادة فتح الصفحة بقيت المجموعة والملاحظات، وأثبت API حالة IN_BETA_TESTING. بقي develop عند مصدر المرشح وقت التسليم.

دليل القبول المنقح: `/Users/tariq/.codex/release-evidence/2026-10-09-unified-entry-testflight/acceptance.json`. [لقطة الإتاحة](/Users/tariq/.codex/visualizations/2026/10/09/01a12097-b86b-7ae2-a5e7-58fa298f27cf/testflight-build34.png).

الأدلة الخاصة والمنقحة: `/Users/tariq/.codex/release-evidence/2026-10-09-unified-entry-testflight/`. مصادر Apple للرفع وTestFlight روجعت بتاريخ9أكتوبر2026 ضمن هذا التسليم.

## حدود القبول

لم يُختبر البناء34 على جهاز فعلي، ولم تُثبت SMS أو رسالة بريد فعليتان، ولم يُنفذ Apple Pay/Moyasar Sandbox لهذا البناء. لا إرسال App Review أو نشر إنتاج. قياس الاستهلاك جزئي، والنسبة الكلية المنسوبة لهذه الجولة غير معلومة.
