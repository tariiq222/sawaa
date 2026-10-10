# TestFlight 1.0.0 (31) — تجميع آخر تعديلات الجوال — 2026-10-09

الحالة النهائية: **1.0.0 (31) متاح في TestFlight ضمن Sawaa Internal**؛ Apple `VALID` و`IN_BETA_TESTING`، متصل بالاستيج. تحقق التسليم9أكتوبر2026 الساعة10:22بتوقيت الرياض.

## المصدر والنطاق

مرشح مجمّد من `origin/develop` عند `8fdae3bd3d42f228ed2b844f1108e9e4ef1603f6`، صُدّر بـ`git archive` إلى مساحة خاصة. لا تعديلات على كود التطبيق فوق هذا المصدر ولا commit أو push أو merge في هذه الجولة. حُفظت التعديلات غير المتعلقة بالإصدار في نسخة العمل الأصلية.

يشمل المصدر الواجهات وإصلاحات الدفع والحجز السابقة، وتعديل الملف الشخصي للمعالج والصورة والنبذة والخبرة واللغات والتحقق من البريد والجوال، وأيقونة العين داخل حقل كلمة المرور، واستدارة زر Apple Pay. إعداد البناء المؤقت `testflight-staging` يثبت API الاستيج وmerchant الموجود؛ ملف production الدائم ومتغيرات الحساب لم يتغيرا.

## الفحوص

- `pnpm --dir apps/mobile typecheck` و`lint`: خروج 0 على المرشح المعزول.
- `pnpm --dir apps/mobile test --runInBand --forceExit`: **229 مجموعة و1693 اختبارًا** ناجحًا، مع فحص coverage. استُخدم forceExit وفق تشغيل الجوال السابق؛ هذه النتيجة لا تثبت غياب open handles.
- تصدير Metro لـiOS مع source map: خروج 0؛ فحص graph أثبت تسجيل `PKPaymentButton` واحدًا.
- ملف provisioning جديد من Apple: `ACTIVE` وصالح حتى 2027-09-24، ويحوي `merchant.sa.sawa.app`. شهادة P12 المحلية تطابق شهادة الملف.
- طابق أرشيف `build:inspect` بصمات 743 ملفًا؛ استُبعدت الأسرار وcredentials والمجلدات الأصلية المولدة، وبقي مصدر وحدة SawaaPayments.
- صحة الاستيج HTTP 200؛ هذا لا يثبت كل المسارات أو المزودين.
- `expo-doctor`: نجح18 من20؛ أبلغ عن اعتماد `expo-modules-core` المباشر الموجود وعن `expo-updates 55.0.31` مقابل التوصية الجديدة `~55.0.33`. تابع EAS وفق سلوكه الافتراضي؛ لم تُغيّر الاعتماديات أو يُعطّل الفحص لإخفاء النتيجة.

## مسار البناء

توقفت المحاولة السحابية قبل إنشاء job بسبب انتهاء حصة iOS المجانية في EAS، بعد حجز الرقم 31. لم تُكرر محاولة الحصة المنتهية ولم تُرقّ الخطة. انتقل التنفيذ إلى `eas build --local` على Xcode 27.0 مع Fastlane 2.240.1 والتوقيع المحلي الموجود وملف Firebase المحلي؛ `autoIncrement=false` في overlay فقط لقراءة الرقم 31 المحجوز.

ثُبت Fastlane من Homebrew مع تحديث اعتماد Ruby إلى4.0.7. كشفت محاولة الفحص المحلي الأولى عدم توافق CocoaPods القديم مع Ruby؛ أُعيد تثبيته عبر Homebrew إلى1.17.0، ونجح `pod --version` و`fastlane --version` قبل إعادة البناء. لم تبدأ المحاولة الأولى native compilation ولم تنتج IPA.

البناء المحلي اكتمل بخروج0. فحص IPA أثبت سلامة ZIP وcodesign strict، وهوية `sa.sawa.app`، والإصدار1.0.0 والبناء31 والفريق569M49FYA6 و`get-task-allow=false`، وpush production وmerchant الصحيح. SDK الفعلي `iphoneos27.0`. الحزمة تحتوي API الاستيج وتستبعد عناوين API الإنتاج، وتضم عقد الملف الشخصي والدفع وPassKit وخلفيتي Aqua والخطوط المطلوبة.

IPA SHA256: `873fbbc0462bdcf3f459d42a569eab128c17e77102a4d21c66243074a0fd8421`.

رفع `altool` نجح بخروج0؛ delivery UUID: `2b692af1-7c08-4aec-930a-1d413da0046e`. ظهر البناء31 في Build Uploads بحالة Processing في9أكتوبر الساعة10:18بتوقيت الرياض. إعداد البناء المؤقت ومرجع credentials أُزيلا من المرشح بعد البناء؛ إعدادات checkout الأصلية لم تُمس.

اكتملت معالجة Apple إلى `VALID`. حُفظ إقرار التشفير وفق إجابة المالك السابقة `None of the algorithms mentioned above` دون تغيير مكتبات التشفير، وصارت `usesNonExemptEncryption=false`. حُفظت What to Test بالعربية `ar-SA` وطابقها استعلام API، وأُضيف البناء إلى `Sawaa Internal` مع مختبر واحد. بعد إعادة فتح الصفحة بقيت المجموعة والملاحظات؛ API أثبت `IN_BETA_TESTING`. Apple build ID يطابق delivery UUID أعلاه. المصدر البعيد بقي عند SHA المرشح وقت التسليم؛ لا تعديلات جوال أحدث مدمجة خارج النسخة في وقت الفحص.

الأدلة الخاصة والمنقحة: `/Users/tariq/.codex/release-evidence/2026-10-09-all-mobile-testflight/acceptance.json`. لقطة الإتاحة: `/Users/tariq/.codex/visualizations/2026/10/09/01a11f70-80f3-79a3-9a40-559c1589f28a/testflight-build31.jpg`.

## حدود القبول

قبول الجهاز الفعلي وApple Pay/Moyasar Sandbox ورفع الصورة وإثبات التواصل عبر مزود فعلي على هذا البناء غير متحقق. لا إرسال App Review أو نشر backend أو إنتاج في هذه الجولة. القياس جزئي بسبب baseline متأخر؛ الاستهلاك الكلي المنسوب للعمل غير معلوم.
