import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7: the CLI (migrate / db push / studio) reads a single connection
// string here. We use the same DATABASE_URL the app uses.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
