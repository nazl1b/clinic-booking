// Environment for the tests: the database URLs come from server/.env.test (the Neon
// branch `test`), everything else from server/.env. The tests empty every table,
// so they refuse to run unless .env.test points to a different database than .env.
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

const DB_VARS = ['DATABASE_URL', 'DIRECT_URL'] as const

function read(file: string): Record<string, string | undefined> {
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {}
}

const host = (url: string | undefined) => (url ? new URL(url).hostname.replace('-pooler', '') : '')

export function loadTestEnv(): void {
  const test = read('.env.test')
  const dev = read('.env')
  for (const name of DB_VARS) {
    if (!test[name]) throw new Error(`${name} is missing in server/.env.test (the Neon branch "test")`)
    if (host(test[name]) === host(dev[name]) || host(test[name]) === host(dev.DATABASE_URL)) {
      throw new Error(`${name} in server/.env.test points to the same database as server/.env. Refusing to empty it.`)
    }
    process.env[name] = test[name]
  }
  // Session secret, time zone, app URL… from .env; never overrides the test database.
  // PROTECT_DEMO_ACCOUNTS is left out: test users have reserved emails, so it would
  // lock their passwords; demoAccounts.test.ts switches it on by itself.
  for (const [name, value] of Object.entries(dev)) {
    if (name === 'PROTECT_DEMO_ACCOUNTS') continue
    if (process.env[name] === undefined && value !== undefined) process.env[name] = value
  }
  process.env.CLINIC_TIMEZONE ||= 'Europe/Athens'
  process.env.APP_URL ||= 'http://localhost:5173'
  process.env.SESSION_SECRET ||= 'test-session-secret'
}
