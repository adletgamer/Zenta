import { PrismaClient } from '../../../../packages/db/generated/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Use global singleton in development to prevent connection exhaustion
export const prisma = global.__prisma || new PrismaClient({
  log: process.env.APP_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.APP_ENV !== 'production') {
  global.__prisma = prisma;
}
