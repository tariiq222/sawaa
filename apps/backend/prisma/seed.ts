/**
 * Dev seed — creates an ADMIN user + singleton configs + main branch.
 * Run:  npm run prisma:seed
 * Safe to re-run: uses upsert everywhere.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createCipheriv, hkdfSync, randomBytes } from "crypto";

// ─── Moyasar encryption helper (same algo as MoyasarCredentialsService) ─────
const HKDF_SALT = "deqah-moyasar-creds-v1";
const HKDF_KEY_LEN = 32;

function encryptMoyasar(
  payload: Record<string, unknown>,
  organizationId: string,
): string {
  const masterKeyRaw = process.env.MOYASAR_ENCRYPTION_KEY;
  if (!masterKeyRaw) throw new Error("MOYASAR_ENCRYPTION_KEY is not set");
  const masterKey = Buffer.from(masterKeyRaw, "base64");
  if (masterKey.length !== 32)
    throw new Error("MOYASAR_ENCRYPTION_KEY must decode to 32 bytes");

  const key = Buffer.from(
    hkdfSync("sha256", masterKey, HKDF_SALT, organizationId, HKDF_KEY_LEN),
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

const ADMIN_EMAIL = process.env.SEED_EMAIL ?? "admin@sawaa-test.com";
const ADMIN_PASSWORD = process.env.SEED_PASSWORD ?? "Admin@1234";
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

const RECEPTIONIST_EMAIL =
  process.env.SEED_RECEPTIONIST_EMAIL ?? "receptionist@sawaa-test.com";
const RECEPTIONIST_PASSWORD =
  process.env.SEED_RECEPTIONIST_PASSWORD ?? "Recept@1234";
const EMPLOYEE_EMAIL =
  process.env.SEED_EMPLOYEE_EMAIL ?? "employee@sawaa-test.com";
const EMPLOYEE_PASSWORD = process.env.SEED_EMPLOYEE_PASSWORD ?? "Employee@1234";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("prisma db seed must not run in production");
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // 0. Cleanup isolation test artifacts (Bug #24)
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { contains: "@t.test" } },
        { email: { startsWith: "iso-" } },
      ],
    },
  });

  // 1. Admin user (email is globally @unique now)
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: "Admin",
      role: "ADMIN",
      isActive: true,
    },
    update: {
      passwordHash,
      name: "Admin",
      role: "ADMIN",
      isActive: true,
    },
  });

  // 1a. Receptionist user (for E2E role-based tests)
  const receptionistPasswordHash = await bcrypt.hash(RECEPTIONIST_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: RECEPTIONIST_EMAIL },
    create: {
      email: RECEPTIONIST_EMAIL,
      passwordHash: receptionistPasswordHash,
      name: "Receptionist",
      role: "RECEPTIONIST",
      isActive: true,
    },
    update: {
      passwordHash: receptionistPasswordHash,
      name: "Receptionist",
      role: "RECEPTIONIST",
      isActive: true,
    },
  });

  // 1b. Employee user (for E2E role-based tests)
  const employeePasswordHash = await bcrypt.hash(EMPLOYEE_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: EMPLOYEE_EMAIL },
    create: {
      email: EMPLOYEE_EMAIL,
      passwordHash: employeePasswordHash,
      name: "Employee",
      role: "EMPLOYEE",
      isActive: true,
    },
    update: {
      passwordHash: employeePasswordHash,
      name: "Employee",
      role: "EMPLOYEE",
      isActive: true,
    },
  });

  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    throw new Error(
      "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required to seed the initial super-admin user",
    );
  }

  const superAdminPasswordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    create: {
      email: SUPER_ADMIN_EMAIL,
      passwordHash: superAdminPasswordHash,
      name: "Platform Admin",
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
      isActive: true,
    },
    update: {
      passwordHash: superAdminPasswordHash,
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
      isActive: true,
    },
  });

  // 2. Organization settings singleton
  const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
  const PAYMENT_CONFIG_SINGLETON_KEY = "singleton";
  const settings = await prisma.organizationSettings.findFirst();
  if (!settings) {
    await prisma.organizationSettings.create({
      data: { paymentMoyasarEnabled: true },
    });
  } else {
    await prisma.organizationSettings.updateMany({
      data: { paymentMoyasarEnabled: true },
    });
  }

  // 3a. Moyasar test config (singleton per org) — seeded with real test keys.
  //     Secrets are encrypted at rest using MOYASAR_ENCRYPTION_KEY.
  const secretKeyEnc = encryptMoyasar(
    { secretKey: "sk_test_dC1t7MVaXhJUmfwSj3QDpT2yRuRSMmdsjQB71zxo" },
    DEFAULT_ORG_ID,
  );
  const webhookSecretEnc = encryptMoyasar(
    { webhookSecret: "whsec_test_dev_webhook_secret_12345" },
    DEFAULT_ORG_ID,
  );
  await prisma.organizationPaymentConfig.upsert({
    where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
    create: {
      singletonKey: PAYMENT_CONFIG_SINGLETON_KEY,
      publishableKey: "pk_test_9WmjNQjvWeKh67QscDUg7Y7YGpuvcpDY9ugi3qkv",
      secretKeyEnc,
      webhookSecretEnc,
      isLive: false,
    },
    update: {},
  });

  // 4. Main branch
  const DEFAULT_BRANCH_ID = "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d5";
  await prisma.branch.upsert({
    where: { id: DEFAULT_BRANCH_ID },
    create: {
      id: DEFAULT_BRANCH_ID,
      nameAr: "الفرع الرئيسي",
      nameEn: "Main Branch",
      isActive: true,
      isMain: true,
      timezone: "Asia/Riyadh",
      country: "SA",
    },
    update: {},
  });

  // 5. Business hours for the main branch (Sun–Thu 09:00–17:00 open, Fri/Sat closed).
  // Required so dev create-booking flow can find available slots.
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri, Sat
    await prisma.businessHour.upsert({
      where: { branchId_dayOfWeek: { branchId: DEFAULT_BRANCH_ID, dayOfWeek } },
      create: {
        branchId: DEFAULT_BRANCH_ID,
        dayOfWeek,
        startTime: "09:00",
        endTime: "17:00",
        isOpen: !isWeekend,
      },
      update: {},
    });
  }

  // 6. Email templates — one row per slug the backend sends.
  //    Free-form: owners rewrite name/subject/body in any language they want.
  const layout = (
    heading: string,
    bodyHtml: string,
  ) => `<div style="font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif; padding: 24px; max-width: 560px; direction: rtl;">
  <h2 style="color: #354FD8; margin: 0 0 16px;">${heading}</h2>
  ${bodyHtml}
</div>`;

  const button = (href: string, label: string) =>
    `<p style="margin: 24px 0;"><a href="${href}" style="background:#354FD8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${label}</a></p>`;

  const TEMPLATES: Array<{
    slug: string;
    name: string;
    subject: string;
    htmlBody: string;
  }> = [
    {
      slug: "user_password_reset",
      name: "إعادة تعيين كلمة المرور",
      subject: "إعادة تعيين كلمة المرور — Sawaa",
      htmlBody: layout(
        "إعادة تعيين كلمة المرور",
        `<p>مرحباً {{userName}}،</p>
  <p>وصلنا طلب لإعادة تعيين كلمة مرورك في Sawaa. اضغط الزر بالأسفل لتعيين كلمة جديدة. الرابط صالح لمدة 30 دقيقة.</p>
  ${button("{{resetUrl}}", "إعادة تعيين كلمة المرور")}
  <p style="color:#6b7280;font-size:14px;">إذا لم تطلب هذا، يمكنك تجاهل الرسالة بأمان.</p>`,
      ),
    },
    {
      slug: "user_email_verification",
      name: "تأكيد البريد الإلكتروني",
      subject: "تأكيد بريدك الإلكتروني — Sawaa",
      htmlBody: layout(
        "تأكيد البريد الإلكتروني",
        `<p>مرحباً {{userName}}،</p>
  <p>اضغط الزر بالأسفل لتأكيد بريدك الإلكتروني وتفعيل حسابك في Sawaa.</p>
  ${button("{{verifyUrl}}", "تأكيد البريد")}
  <p style="color:#6b7280;font-size:14px;">إذا لم تنشئ هذا الحساب، يمكنك تجاهل الرسالة.</p>`,
      ),
    },
    {
      slug: "welcome",
      name: "رسالة ترحيب",
      subject: "أهلاً بك في Sawaa",
      htmlBody: layout(
        "أهلاً بك",
        `<p>مرحباً {{client_name}}،</p>
  <p>سعداء بانضمامك إلينا. حسابك جاهز الآن، ويمكنك حجز موعدك الأول في أي وقت.</p>`,
      ),
    },
    {
      slug: "booking-cancelled",
      name: "إلغاء حجز",
      subject: "تم إلغاء حجزك",
      htmlBody: layout(
        "تم إلغاء حجزك",
        `<p>مرحباً {{client_name}}،</p>
  <p>نأسف لإبلاغك بأنه تم إلغاء حجزك رقم <strong>{{booking_id}}</strong>.</p>
  <p>السبب: {{reason}}</p>
  <p>يمكنك إعادة الحجز في أي وقت من تطبيق Sawaa.</p>`,
      ),
    },
    {
      slug: "payment-failed",
      name: "فشل عملية دفع",
      subject: "تعذّر إتمام الدفع",
      htmlBody: layout(
        "تعذّر إتمام الدفع",
        `<p>مرحباً {{client_name}}،</p>
  <p>لم نتمكن من معالجة دفعتك بقيمة <strong>{{amount}} {{currency}}</strong>.</p>
  <p>يرجى التحقق من بيانات بطاقتك أو تجربة وسيلة دفع أخرى.</p>`,
      ),
    },
    {
      slug: "booking-reminder",
      name: "تذكير بموعد",
      subject: "تذكير بموعدك غداً",
      htmlBody: layout(
        "تذكير بموعدك",
        `<p>مرحباً {{client_name}}،</p>
  <p>نذكّرك بموعدك <strong>{{service_name}}</strong> غداً الساعة <strong>{{time}}</strong>.</p>
  <p>إذا احتجت إعادة جدولته أو إلغاءه، تواصل معنا قبل الموعد بوقت كافٍ.</p>`,
      ),
    },
    {
      slug: "group-session-payment-due",
      name: "اكتمل الحد الأدنى للجلسة الجماعية",
      subject: "اكتمل الحد الأدنى — يرجى إتمام الدفع",
      htmlBody: layout(
        "اكتمل الحد الأدنى للجلسة الجماعية",
        `<p>مرحباً {{client_name}}،</p>
  <p>الخبر السار: اكتمل الحد الأدنى للجلسة الجماعية وتم تأكيدها.</p>
  <p>لتأمين مقعدك، يرجى إتمام الدفع بقيمة <strong>{{amount}} {{currency}}</strong> خلال <strong>24 ساعة</strong>.</p>
  ${button("{{payment_url}}", "إتمام الدفع")}
  <p style="color:#6b7280;font-size:14px;">في حال عدم الدفع خلال المدة، قد يفقد مقعدك لصالح عميل آخر.</p>`,
      ),
    },
  ];

  for (const tmpl of TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { slug: tmpl.slug },
    });
    if (!existing) {
      await prisma.emailTemplate.create({
        data: {
          slug: tmpl.slug,
          name: tmpl.name,
          subject: tmpl.subject,
          htmlBody: tmpl.htmlBody,
          isActive: true,
        },
      });
    }
  }

  await prisma.$disconnect();

  console.log("─────────────────────────────────────────────");
  console.log(`✔  Admin        : ${ADMIN_EMAIL}`);
  console.log(`✔  Receptionist : ${RECEPTIONIST_EMAIL}`);
  console.log(`✔  Employee     : ${EMPLOYEE_EMAIL}`);
  console.log(`✔  Super admin  : ${SUPER_ADMIN_EMAIL}`);
  console.log(`✔  OrganizationSettings singleton ready`);
  console.log(`✔  Main branch created`);
  console.log(`✔  BusinessHours seeded (Sun–Thu 09:00–17:00, Fri/Sat closed)`);
  console.log(
    `✔  Email templates upserted: ${TEMPLATES.map((t) => t.slug).join(", ")}`,
  );
  console.log(`✔  Moyasar test config seeded (pk_test_…)`);
  console.log("─────────────────────────────────────────────");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
