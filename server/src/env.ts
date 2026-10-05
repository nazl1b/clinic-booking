// Locally, environment variables come from server/.env.
// Online, Render provides them, so the file does not exist there.
// This file must be imported first in server.ts, before anything that reads process.env.
try {
  process.loadEnvFile()
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
}
