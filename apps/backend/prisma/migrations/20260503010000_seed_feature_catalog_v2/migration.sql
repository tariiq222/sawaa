-- Seed platform-level catalog rows (organizationId IS NULL) for the 15 new Phase 3 keys.
-- Idempotent: uses WHERE NOT EXISTS because @@unique([organizationId, key]) does NOT
-- deduplicate NULL organizationId rows via ON CONFLICT (Postgres treats each NULL as distinct).

DO $$
BEGIN
  -- zoom_integration
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'zoom_integration', false, ARRAY[]::text[], NULL, 'تكامل زووم', 'Zoom Integration', 'إنشاء روابط زووم تلقائيًا للحجوزات الافتراضية', 'Auto-generate Zoom links for virtual appointments', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'zoom_integration');

  -- walk_in_bookings
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'walk_in_bookings', false, ARRAY[]::text[], NULL, 'الحجوزات الفورية', 'Walk-in Bookings', 'تسجيل العملاء غير المحجوزين عند وصولهم', 'Register unscheduled clients on arrival', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'walk_in_bookings');

  -- bank_transfer_payments
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'bank_transfer_payments', false, ARRAY[]::text[], NULL, 'الدفع بالتحويل البنكي', 'Bank Transfer Payments', 'قبول مدفوعات عبر إيصالات تحويل بنكي مرفقة', 'Accept payments via uploaded bank-transfer receipts', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'bank_transfer_payments');

  -- multi_branch
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'multi_branch', false, ARRAY[]::text[], NULL, 'تعدد الفروع', 'Multi-Branch', 'تشغيل أكثر من فرع تحت نفس المنشأة', 'Operate more than one branch under the same org', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'multi_branch');

  -- departments
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'departments', false, ARRAY[]::text[], NULL, 'الأقسام', 'Departments', 'تنظيم الموظفين والخدمات داخل أقسام إدارية', 'Organize employees and services into departments', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'departments');

  -- client_ratings
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'client_ratings', false, ARRAY[]::text[], NULL, 'تقييمات العملاء', 'Client Ratings', 'جمع تقييمات العملاء بعد كل موعد', 'Collect client feedback after each appointment', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'client_ratings');

  -- data_export
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'data_export', false, ARRAY[]::text[], NULL, 'تصدير البيانات', 'Data Export', 'تصدير التقارير والقوائم بصيغ CSV / Excel', 'Export reports and lists as CSV / Excel', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'data_export');

  -- sms_provider_per_tenant
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'sms_provider_per_tenant', false, ARRAY[]::text[], NULL, 'مزود رسائل SMS خاص', 'Dedicated SMS Provider', 'ربط مزود رسائل خاص بالمنشأة (Unifonic / Taqnyat)', 'Connect your own SMS provider (Unifonic / Taqnyat)', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'sms_provider_per_tenant');

  -- white_label_mobile
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'white_label_mobile', false, ARRAY[]::text[], NULL, 'تطبيق جوال بهوية المنشأة', 'White-label Mobile App', 'نشر تطبيق جوال مستقل باسم وهوية المنشأة', 'Publish a standalone mobile app under your brand', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'white_label_mobile');

  -- custom_domain
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'custom_domain', false, ARRAY[]::text[], NULL, 'نطاق مخصص', 'Custom Domain', 'ربط نطاق المنشأة الخاص بلوحة التحكم', 'Map your own domain to the dashboard', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'custom_domain');

  -- api_access
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'api_access', false, ARRAY[]::text[], NULL, 'الوصول إلى الـAPI', 'API Access', 'إصدار مفاتيح API للتكامل مع أنظمتك الخارجية', 'Issue API keys to integrate with external systems', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'api_access');

  -- webhooks
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'webhooks', false, ARRAY[]::text[], NULL, 'إشعارات Webhooks', 'Webhooks', 'إرسال أحداث المنصة إلى مسارات HTTP خارجية', 'Push platform events to external HTTP endpoints', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'webhooks');

  -- priority_support
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'priority_support', false, ARRAY[]::text[], NULL, 'دعم فني ذو أولوية', 'Priority Support', 'قناة دعم فني سريعة الاستجابة على مدار الساعة', 'Fast-response support channel, 24/7', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'priority_support');

  -- audit_export
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'audit_export', false, ARRAY[]::text[], NULL, 'تصدير سجل التدقيق', 'Audit Log Export', 'تصدير سجل النشاط لأرشفته خارج المنصة', 'Export the activity log for off-platform archival', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'audit_export');

  -- multi_currency
  INSERT INTO "FeatureFlag" ("id", "organizationId", "key", "enabled", "allowedPlans", "limitKind", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), NULL, 'multi_currency', false, ARRAY[]::text[], NULL, 'تعدد العملات', 'Multi-Currency', 'إصدار فواتير ومدفوعات بأكثر من عملة', 'Issue invoices and payments in multiple currencies', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "organizationId" IS NULL AND "key" = 'multi_currency');
END $$;
