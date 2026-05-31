# دليل الاستعادة من النسخ الاحتياطية (Restore Runbook)

دليل تشغيلي لاستعادة قاعدة بيانات PostgreSQL وملفات MinIO من النسخ الاحتياطية
المُشفّرة التي تنتجها سكربتات `docker/scripts/backup.sh` و `docker/scripts/backup-minio.sh`.

> تنبيه: عملية الاستعادة **مدمّرة** — تكتب فوق البيانات الحالية. اقرأ الدليل
> بالكامل ونفّذ على بيئة staging أولاً قبل الإنتاج.

---

## 1. المتطلبات المسبقة (Prerequisites)

- وصول إلى حاوية النسخ الاحتياطي (backup container) أو أي مضيف فيه السكربتات
  وأدوات: `openssl`, `gzip`/`gunzip`, `tar`, `psql`, `mc` (MinIO client).
- ملف النسخة الاحتياطية المطلوب استعادته:
  - قاعدة البيانات: `postgres_<db>_<timestamp>.sql.gz.enc` (أو `.sql.gz` غير مُشفّر).
  - MinIO: `<bucket>_<timestamp>.tar.gz.enc`.
- متغيرات البيئة:
  - `BACKUP_ENCRYPTION_KEY` — **نفس** المفتاح المستخدم وقت النسخ (إلزامي للملفات `.enc`).
  - قاعدة البيانات: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`,
    `POSTGRES_PASSWORD`, `POSTGRES_DB`.
  - MinIO: `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`.
- إذا كانت النسخة مخزّنة offsite (S3/MinIO خارجي): نزّلها أولاً محلياً عبر
  `mc cp` أو `aws s3 cp` قبل البدء.

> ملاحظة: التشفير في النسخ الاحتياطي يستخدم KDF حديث (PBKDF2 / 100000 تكرار /
> SHA-256). الاستعادة تستخدم **نفس** هذه الإعدادات؛ لا تستخدم أعلام أقدم.

---

## 2. خطوة فك التشفير والتحقق (Decrypt & Verify)

قبل أي استعادة، تأكّد أن الملف سليم وقابل للفك (round-trip) دون لمس القاعدة:

```sh
# قاعدة البيانات (sql.gz.enc) — يجب أن ينتهي بدون أخطاء
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -md sha256 \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
  -in postgres_<db>_<timestamp>.sql.gz.enc \
  | gunzip -t && echo "OK: dump سليم"

# أرشيف MinIO (tar.gz.enc)
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -md sha256 \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
  -in <bucket>_<timestamp>.tar.gz.enc \
  | gunzip -t && echo "OK: archive سليم"
```

إذا فشل التحقق: المفتاح خاطئ أو الملف تالف — **توقف** ولا تكمل الاستعادة.

---

## 3. استعادة قاعدة البيانات (DB Restore)

السكربت `restore.sh` يقوم بفك التشفير + `gunzip` + `psql` في خطوة واحدة، مع
فحص سلامة مسبق وحاجز أمان ضد الكتابة العرضية.

```sh
# يرفض التنفيذ بدون تأكيد صريح
CONFIRM=yes sh docker/scripts/restore.sh db \
  /backups/postgres_<db>_<timestamp>.sql.gz.enc

# بديل: تمرير العلم --force بدل متغير البيئة
sh docker/scripts/restore.sh db \
  /backups/postgres_<db>_<timestamp>.sql.gz.enc --force
```

- بدون `CONFIRM=yes` أو `--force` سيتوقّف السكربت برمز خروج `2` (حماية مقصودة).
- `psql` يعمل بـ `ON_ERROR_STOP=1`؛ أي خطأ في الـ SQL يوقف الاستعادة فوراً.
- يُفضّل الاستعادة على قاعدة فارغة/جديدة لتفادي تعارض البيانات الموجودة.

### استعادة يدوية (إن لزم بدون السكربت)

```sh
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -md sha256 \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
  -in postgres_<db>_<timestamp>.sql.gz.enc \
  | gunzip \
  | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
      -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
      -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1
```

---

## 4. استعادة MinIO (Object Storage Restore)

```sh
CONFIRM=yes sh docker/scripts/restore.sh minio \
  /backups/<bucket>_<timestamp>.tar.gz.enc <bucket>
```

- يفك التشفير، يفك ضغط الأرشيف في مجلد مؤقت، ثم `mc mirror` إلى الباكِت الهدف.
- ينشئ الباكِت إن لم يكن موجوداً (`mc mb --ignore-existing`).
- نفس حاجز الأمان: يتطلب `CONFIRM=yes` أو `--force`.

### استعادة يدوية لـ MinIO

```sh
mkdir -p /tmp/restore && \
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -md sha256 \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
  -in <bucket>_<timestamp>.tar.gz.enc \
  | tar xzf - -C /tmp/restore

mc alias set local_minio "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"
mc mb --ignore-existing local_minio/<bucket>
mc mirror /tmp/restore/<bucket>_<timestamp> local_minio/<bucket>
rm -rf /tmp/restore
```

---

## 5. ملاحظة الرجوع للخلف عند النشر (Deploy Rollback)

استعادة قاعدة البيانات تُعيد **البيانات** فقط، لا الكود. عند الرجوع:

1. أوقف التطبيق (backend/dashboard/website) لمنع الكتابة أثناء الاستعادة.
2. ارجع الكود للإصدار المتوافق مع schema النسخة (نفس migration tag/commit).
   لا تستعد dump قديم على schema أحدث دون التأكد من توافق الـ migrations
   (الهجرات additive-only — راجع `CLAUDE.md`).
3. استعد قاعدة البيانات ثم MinIO.
4. شغّل التطبيق وتحقق من الصحة (health checks + تسجيل دخول + حجز تجريبي).
5. وثّق وقت بدء/انتهاء الرجوع وسبب الحادثة.

---

## 6. قائمة تمرين الاستعادة (Restore Drill Checklist)

يُنفّذ دورياً (شهرياً مقترح) على بيئة staging للتأكد أن النسخ قابلة للاستعادة فعلاً:

- [ ] اختر أحدث نسخة `postgres_*.sql.gz.enc` وأحدث `*_*.tar.gz.enc`.
- [ ] (إن offsite) نزّل النسخ محلياً وتأكد من حجمها.
- [ ] نفّذ فحص فك التشفير + `gunzip -t` لكل ملف (القسم 2) — يجب أن يمر.
- [ ] استعد قاعدة البيانات على DB استعراضي منفصل (ليس الإنتاج).
- [ ] استعد MinIO على باكِت استعراضي منفصل.
- [ ] شغّل التطبيق مقابل البيانات المستعادة وتحقق من:
      - [ ] تسجيل الدخول يعمل.
      - [ ] قائمة الحجوزات تظهر بيانات حقيقية.
      - [ ] الملفات/المرفقات في MinIO تُفتح.
- [ ] سجّل: زمن الاستعادة (RTO)، عمر أحدث نسخة (RPO)، أي مشاكل.
- [ ] احذف بيانات التمرين الاستعراضية بعد الانتهاء.
- [ ] إذا فشل أي بند: افتح تذكرة P1 وأصلح مسار النسخ قبل الاعتماد عليه.

---

## 7. متابعات (Followups — خارج نطاق هذا الملف)

- ربط متغيرات الـ offsite (`BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`,
  `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`) في ملفات docker-compose
  وأسرار النشر (يملكها فريق/وكيل النشر).
- جدولة تمرين الاستعادة الشهري في الـ cron مع تنبيه عند الفشل.
