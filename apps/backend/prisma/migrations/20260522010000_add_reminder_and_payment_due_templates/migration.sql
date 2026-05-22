-- Add two email templates wired into events that previously lacked email channel.
-- INSERT only if missing — never overwrites operator edits.

INSERT INTO "EmailTemplate" (id, slug, name, subject, "htmlBody", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'booking-reminder', 'تذكير بموعد', 'تذكير بموعدك غداً',
  '<div style="font-family: ''IBM Plex Sans Arabic'', system-ui, sans-serif; padding: 24px; max-width: 560px; direction: rtl;">
  <h2 style="color: #354FD8; margin: 0 0 16px;">تذكير بموعدك</h2>
  <p>مرحباً {{client_name}}،</p>
  <p>نذكّرك بموعدك <strong>{{service_name}}</strong> غداً الساعة <strong>{{time}}</strong>.</p>
  <p>إذا احتجت إعادة جدولته أو إلغاءه، تواصل معنا قبل الموعد بوقت كافٍ.</p>
</div>',
  true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "EmailTemplate" WHERE slug = 'booking-reminder');

INSERT INTO "EmailTemplate" (id, slug, name, subject, "htmlBody", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'group-session-payment-due', 'اكتمل الحد الأدنى للجلسة الجماعية', 'اكتمل الحد الأدنى — يرجى إتمام الدفع',
  '<div style="font-family: ''IBM Plex Sans Arabic'', system-ui, sans-serif; padding: 24px; max-width: 560px; direction: rtl;">
  <h2 style="color: #354FD8; margin: 0 0 16px;">اكتمل الحد الأدنى للجلسة الجماعية</h2>
  <p>مرحباً {{client_name}}،</p>
  <p>الخبر السار: اكتمل الحد الأدنى للجلسة الجماعية وتم تأكيدها.</p>
  <p>لتأمين مقعدك، يرجى إتمام الدفع بقيمة <strong>{{amount}} {{currency}}</strong> خلال <strong>24 ساعة</strong>.</p>
  <p style="margin: 24px 0;"><a href="{{payment_url}}" style="background:#354FD8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">إتمام الدفع</a></p>
  <p style="color:#6b7280;font-size:14px;">في حال عدم الدفع خلال المدة، قد يفقد مقعدك لصالح عميل آخر.</p>
</div>',
  true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "EmailTemplate" WHERE slug = 'group-session-payment-due');
