// Configuration of the Prisma CLI (generate, migrate, seed).
// The app itself connects in src/db.ts.
import { defineConfig, env } from 'prisma/config'

// Same as src/env.ts: server/.env locally, Render's variables online.
try {
  process.loadEnvFile()
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrations need the direct (non-pooled) connection.
    url: env('DIRECT_URL'),
  },
})
