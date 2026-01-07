import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Construct DATABASE_URL if not provided (for production environment where individual vars are set)
const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'theitalys_reservations';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || '';
  const ssl = process.env.DB_SSL === 'true';

  // Construct the URL: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require (if ssl)
  let url = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
  
  if (ssl) {
    url += '?sslmode=require';
  }

  return url;
};

// Log the constructed URL (masking password) for debugging purposes if needed
const databaseUrl = getDatabaseUrl();
// console.log(`Initializing Prisma with URL: ${databaseUrl.replace(/:([^@]+)@/, ':****@')}`);

export const prisma = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
