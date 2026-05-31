/**
 * Production-safe admin bootstrap — creates the first super-admin user.
 *
 * Unlike `prisma/seed.ts` (which refuses to run in production and wipes test
 * artifacts), this script is allowed to run against a fresh production
 * database. It is idempotent: re-running it never deletes data and only
 * updates the existing super-admin's password/flags.
 *
 * Run:  SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... pnpm run bootstrap:admin
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

async function main() {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    throw new Error(
      "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required to bootstrap the initial super-admin user",
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  try {
    // Idempotency guard: if a super-admin already exists, do nothing.
    // This makes the script safe to re-run on every deploy.
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { isSuperAdmin: true },
    });
    if (existingSuperAdmin) {
      console.log("─────────────────────────────────────────────");
      console.log(
        `✔  Super admin already exists: ${existingSuperAdmin.email} — nothing to do`,
      );
      console.log("─────────────────────────────────────────────");
      return;
    }

    // Create (or re-key, if a non-super-admin row already holds this email)
    // the initial super-admin. Mirrors the super-admin upsert in seed.ts.
    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
    const superAdmin = await prisma.user.upsert({
      where: { email: SUPER_ADMIN_EMAIL },
      create: {
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        name: "Platform Admin",
        role: "SUPER_ADMIN",
        isSuperAdmin: true,
        isActive: true,
      },
      update: {
        passwordHash,
        role: "SUPER_ADMIN",
        isSuperAdmin: true,
        isActive: true,
      },
    });

    console.log("─────────────────────────────────────────────");
    console.log(`✔  Super admin bootstrapped: ${superAdmin.email}`);
    console.log("─────────────────────────────────────────────");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
