// One-time bootstrap: creates the first ADMIN account from env vars. There's no other
// way to get an ADMIN into the system, since /auth/signup always forces role: CUSTOMER
// and /users/staff (which creates MANAGER/ADMIN accounts) itself requires an ADMIN to
// call it. Run manually with `pnpm run seed` — not exposed as an API route.
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { normalizeEmail, normalizePassword } from '../src/common/utils/credentials.util';

process.loadEnvFile('.env');

async function main() {
  const rawEmail = process.env.SEED_ADMIN_EMAIL;
  const rawPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!rawEmail || !rawPassword) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env to seed the first admin');
  }
  const email = normalizeEmail(rawEmail);
  const password = normalizePassword(rawPassword);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] ${email} already exists (role: ${existing.role}) — nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: { email, password: hashed, name: 'Admin', role: Role.ADMIN },
  });

  console.log(`[seed] Created ADMIN account ${admin.email}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
