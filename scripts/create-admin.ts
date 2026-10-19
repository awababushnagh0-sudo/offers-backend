/**
 * Creates an admin account and prints a temporary password once.
 *
 *   npm run admin:create -- --email you@example.ly --name "Your Name"
 *
 * The admin must change the password after first login.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../src/generated/prisma/client.js';
import { generateTemporaryPassword } from '../src/common/utils/temporary-password.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
  },
});

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
if (!email || !email.includes('@') || !name) {
  console.error(
    'Usage: npm run admin:create -- --email you@example.ly --name "Your Name"',
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

try {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`A user with email ${email} already exists.`);
    process.exit(1);
  }

  const temporaryPassword = generateTemporaryPassword(14);
  await prisma.user.create({
    data: {
      role: UserRole.ADMIN,
      email,
      name,
      passwordHash: await hash(temporaryPassword),
      mustChangePassword: true,
    },
  });

  console.log(`Admin created: ${email}`);
  console.log(`Temporary password (shown once): ${temporaryPassword}`);
  console.log('Log in and change it with POST /api/v1/auth/change-password.');
} finally {
  await prisma.$disconnect();
}
