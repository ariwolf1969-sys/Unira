import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  // If Turso auth token is present, use the libsql adapter (for Turso cloud)
  // Otherwise, fall back to local SQLite
  if (authToken && dbUrl.startsWith('libsql://')) {
    const adapter = new PrismaLibSQL({ url: dbUrl, authToken });
    return new PrismaClient({ adapter });
  }

  // Local SQLite fallback
  return new PrismaClient({
    datasources: {
      db: {
        url: dbUrl.startsWith('file:') ? dbUrl : `file:${dbUrl}`,
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
