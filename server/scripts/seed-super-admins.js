import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const OFFICIAL_SUPER_ADMINS = [
  {
    name: "Melody",
    email: "registrar@cibionline.org",
    password: "MelodyCibi@2026"
  },
  {
    name: "Joshua Iginla",
    email: "rector@cibionline.org",
    password: "JoshuaIginla@2026"
  },
  {
    name: "Pastor Samuel Owoseni",
    email: "dean@cibionline.org",
    password: "PastorSamuelOwoseni@2026"
  },
  {
    name: "Moses Olatunji",
    email: "admin@cibionline.org",
    password: "MosesOlatunji@2026",
    useExistingMosesAccount: true
  }
];

async function ensureAuditLogTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminActivityLog" (
      "id" SERIAL PRIMARY KEY,
      "adminId" INTEGER,
      "action" TEXT NOT NULL,
      "entityType" TEXT,
      "entityId" TEXT,
      "details" TEXT,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "AdminActivityLog"
      ADD COLUMN IF NOT EXISTS "adminId" INTEGER,
      ADD COLUMN IF NOT EXISTS "action" TEXT NOT NULL DEFAULT 'SYSTEM',
      ADD COLUMN IF NOT EXISTS "entityType" TEXT,
      ADD COLUMN IF NOT EXISTS "entityId" TEXT,
      ADD COLUMN IF NOT EXISTS "details" TEXT,
      ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
      ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      ALTER TABLE "AdminActivityLog"
      ADD CONSTRAINT "AdminActivityLog_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AdminActivityLog_adminId_idx" ON "AdminActivityLog"("adminId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AdminActivityLog_action_idx" ON "AdminActivityLog"("action");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AdminActivityLog_createdAt_idx" ON "AdminActivityLog"("createdAt");`);
}

async function findCurrentMosesAccount() {
  const byOfficialEmail = await prisma.user.findUnique({ where: { email: "admin@cibionline.org" } });
  if (byOfficialEmail) return byOfficialEmail;

  const byName = await prisma.user.findFirst({
    where: { name: { contains: "moses", mode: "insensitive" } },
    orderBy: { id: "asc" }
  });
  if (byName) return byName;

  return prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    orderBy: { id: "asc" }
  });
}

async function logSystem(action, user, details = {}) {
  try {
    await prisma.adminActivityLog.create({
      data: {
        adminId: user?.id || null,
        action,
        entityType: "User",
        entityId: user?.id ? String(user.id) : null,
        details: JSON.stringify(details),
        ipAddress: "render-shell",
        userAgent: "seed-super-admins.js"
      }
    });
  } catch (error) {
    console.warn("Audit log warning:", error.message);
  }
}

async function ensureSuperAdmin(account) {
  let user = await prisma.user.findUnique({ where: { email: account.email } });
  let action = "UPDATED_SUPER_ADMIN_ACCOUNT";

  if (!user && account.useExistingMosesAccount) {
    const currentMoses = await findCurrentMosesAccount();
    if (currentMoses) {
      user = await prisma.user.update({
        where: { id: currentMoses.id },
        data: {
          name: account.name,
          email: account.email,
          role: "SUPER_ADMIN",
          status: "ACTIVE"
        }
      });
      await logSystem("UPDATED_CURRENT_MOSES_SUPER_ADMIN_EMAIL", user, {
        name: account.name,
        email: account.email,
        note: "Existing Moses/current super admin account was reused. Password was not changed."
      });
      return { user, action: "updated existing Moses account", password: "same existing password" };
    }
  }

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: account.name,
        role: "SUPER_ADMIN",
        status: "ACTIVE"
      }
    });
    await logSystem(action, user, {
      name: account.name,
      email: account.email,
      note: "Existing account upgraded/confirmed as SUPER_ADMIN. Password was not changed."
    });
    return { user, action: "updated existing account", password: "same existing password" };
  }

  const hashedPassword = await bcrypt.hash(account.password, 12);
  user = await prisma.user.create({
    data: {
      name: account.name,
      email: account.email,
      password: hashedPassword,
      role: "SUPER_ADMIN",
      status: "ACTIVE"
    }
  });

  await logSystem("CREATED_SUPER_ADMIN_ACCOUNT", user, {
    name: account.name,
    email: account.email,
    note: "New official SUPER_ADMIN account created."
  });

  return { user, action: "created new account", password: account.password };
}

async function main() {
  console.log("Starting CIBI official Super Admin setup...");
  await ensureAuditLogTable();

  const results = [];
  for (const account of OFFICIAL_SUPER_ADMINS) {
    const result = await ensureSuperAdmin(account);
    results.push({
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
      action: result.action,
      password: result.password
    });
    console.log(`Super Admin ready: ${result.user.name} / ${result.user.email} / ${result.action}`);
  }

  console.log("\nCIBI Super Admin setup completed.");
  console.log("Official Super Admins:");
  for (const result of results) {
    console.log(`${result.name} | ${result.email} | ${result.password}`);
  }

  console.log("\nImportant:");
  console.log("- Existing accounts keep their current passwords.");
  console.log("- Passwords shown above are only for newly created accounts.");
  console.log("- Ask each Super Admin to reset/change password after first login.");
}

main()
  .catch((error) => {
    console.error("Super Admin setup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
