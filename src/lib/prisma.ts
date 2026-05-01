import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Use absolute path for SQLite to avoid parent .env override issues
  const dbPath = process.env.DATABASE_URL || 'file:/home/z/my-project/unira-app/prisma/dev.db';
  return new PrismaClient({
    datasources: {
      db: {
        url: dbPath,
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
