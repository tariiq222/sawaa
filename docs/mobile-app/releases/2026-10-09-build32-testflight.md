# TestFlight 1.0.0 (32) — آخر تغييرات الحساب والدخول — 2026-10-09

الحالة النهائية: **1.0.0 (32) متاح في TestFlight ضمن Sawaa Internal**؛ Apple `VALID` و`IN_BETA_TESTING`، متصل بالاستيج. تحقق الحفظ بعد إعادة فتح الصفحة في9أكتوبر2026 نحو15:33بتوقيت الرياض.

## المصدر والنطاق

مصدر مجمد من `origin/develop` عند `bfba96e24463d8f2115376c70467e0e5f5ffda4e`، صُدّر باستخدام `git archive` إلى مساحة خاصة. يشمل PR #183 وإعادة ترتيب صفحة الحساب: الدخول أو إنشاء الحساب برقم الجوال ورمز التحقق، تأكيد البريد، تغيير الجوال برمز للرقم الجديد، إنهاء الجلسات الأخرى بعد تغيير الرقم، وروابط الدخول بالبريد والموظفين. يشمل أيضًا تحسينات الواجهات والحجز والدفع وملف الموظف السابقة.

إعداد مؤقت `testflight-staging` يثبت `https://staging.sawaa.sa/api/v1` وقناة staging وmerchant الموجود، مع توقيع محلي. بيئة EAS المسماة production توفر إعدادات البناء، لكنها لا تغير عنوان API المحدد صراحة. أُعيد إعداد المرشح وأُزيل مرجع credentials بعد البناء؛ إعدادات checkout الأصلي وتعديل المتجر السابق غير المتعلق بالإصدار محفوظة. لا commit أو push أو merge أو نشر خادم في هذه الجولة.

## الفحوص والبناء

- تثبيت frozen lockfiles وبناء shared: نجاح.
- `pnpm --dir apps/mobile typecheck` و`lint`: خروج 0.
- `pnpm --dir apps/mobile test --runInBand --forceExit`: **232 مجموعة / 1712 اختبارًا** ناجحًا، مع coverage. لا يثبت forceExit غياب open handles.
- تصدير Metro لـiOS وفحص source map: نجاح. فحص source map الناتج عن البناء الأصلي أيضًا أثبت تسجيل `PKPaymentButton` واحدًا.
- طابقت ملفات الأرشيف وملفات البناء الفعلية بصمات **772 ملفًا**. استُبعدت الأسرار وcredentials والمجلدات الأصلية المولدة، وبقي مصدر SawaaPayments.
- ملف provisioning لدى Apple: ACTIVE وصالح حتى 2027-09-24، وصلاحية Apple Pay موجودة؛ شهادة P12 المحلية تطابق الملف.
- `expo-doctor`: 18/20؛ ملاحظتان سابقتان تخصان اعتماد expo-modules-core المباشر وexpo-updates 55.0.31 مقابل التوصية ~55.0.33. لم تتغير الاعتماديات أو يُعطّل الفحص لإخفائهما.
- استخدم البناء المحلي `eas build --local` مباشرة بسبب حصة EAS السحابية المنتهية المسجلة في البناء31؛ لم تُكرر محاولة الحصة ولم تُغير خطة الحساب. حُجز الرقم32 من EAS، واكتمل البناء بخروج0 على Xcode27.0 وFastlane2.240.1 وCocoaPods1.17.0.
- IPA: ZIP سليم وcodesign strict ناجح، `sa.sawa.app` / `1.0.0 (32)` / الفريق569M49FYA6، وget-task-allow=false وpush production وmerchant.sa.sawa.app. SDK: iphoneos27.0. عنوان الاستيج موجود وعناوين API الإنتاج غائبة؛ عقود الدخول بالجوال والتحقق من البريد والجوال وPassKit والخطوط والخلفيات موجودة.

IPA SHA256: `c76e0418549441fd241ccf34e1159816be6509a1a8def05a6bddf5c506e7abc6`.

## تسليم Apple

نجح `altool` بخروج0. معرف التسليم: `9b75b237-fe07-4dda-8193-08c3960f3339`. ظهر البناء32 في Build Uploads بتاريخ9أكتوبر2026 الساعة15:27بتوقيت الرياض بحالة Processing. لا EAS cloud build ID لهذا البناء المحلي.

اكتملت المعالجة إلى `VALID`. حُفظ إقرار التشفير وفق إجابة المالك السابقة `None of the algorithms mentioned above` دون تغيير مكتبات التشفير، وأثبت API أن `usesNonExemptEncryption=false`. حُفظت What to Test بالعربية `ar-SA` وطابقها استعلام API، ثم أُضيف البناء إلى Sawaa Internal بمختبر واحد. بعد إعادة فتح الصفحة بقيت المجموعة والملاحظات، وأثبت API حالة `IN_BETA_TESTING`. معرف بناء Apple يطابق معرف التسليم أعلاه. بقي origin/develop عند مصدر المرشح وقت التحقق النهائي.

دليل القبول المنقح: `/Users/tariq/.codex/release-evidence/2026-10-09-phone-entry-testflight/acceptance.json`. [لقطة الإتاحة](/Users/tariq/.codex/visualizations/2026/10/09/01a12097-b86b-7ae2-a5e7-58fa298f27cf/testflight-build32.png).

الأدلة الخاصة: `/Users/tariq/.codex/release-evidence/2026-10-09-phone-entry-testflight/`. راجعت مصادر Apple الرسمية للرفع وTestFlight بتاريخ9أكتوبر2026: [رفع البناء](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)، [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).

## حدود التحقق

الاستيج يعيد health HTTP200، ومسار حالة بريد العميل المحمي يرد401؛ هذا لا يثبت رحلة OTP أو تنفيذ migration أو كل عقود الخادم. لم يُختبر هذا البناء على جهاز فعلي، ولم تُرسل SMS أو بريد فعليان، ولم يُنفذ Apple Pay/Moyasar Sandbox على هذا البناء. لا إرسال App Review ولا نشر إنتاج. القياس جزئي، والاستهلاك الكلي المنسوب للعمل غير معلوم.
