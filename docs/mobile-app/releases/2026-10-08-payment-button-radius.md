# توحيد انحناء أزرار الدفع — 2026-10-08

تعديل محلي على `develop` انطلاقًا من `5855a2bdc` في `apps/mobile/features/payments/DeferredApplePayButton.tsx`: تغيير `cornerRadius` لزر Apple Pay من11 إلى25، نصف ارتفاعه50، ليصبح دائري الطرفين مثل زري البطاقة والدفع في المركز. التغيير خاص بالزوايا فقط.

نجح الأمر `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath features/payments/__tests__/DeferredApplePayButton.test.tsx 'app/(client)/booking/__tests__/confirm.test.tsx'`: مجموعتان و42اختبارًا. ظهر تنبيه Jest حول عمليات غير مغلقة بعد اكتمال الاختبارات؛ انتهى الأمر بالرمز0.

لم تُجرَ معاينة محاكي/جهاز أو dashboard smoke أو Moyasar Sandbox لهذا التعديل. وافق المالك على حفظه مع تعديل كلمة المرور في commit محلي على `develop`؛ لا push أو بناء أو رفع TestFlight، والتغيير ليس ضمن البناء27 الموجود. حُفظت تعديلات التوثيق السابقة.
