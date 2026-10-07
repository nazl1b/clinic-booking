// Runs once before all test files: applies the migrations to the test database.
import { execSync } from 'node:child_process'
import { loadTestEnv } from './env.js'

export default function setup(): void {
  loadTestEnv()
  // prisma.config.ts does not override variables that are already set, so this
  // uses DIRECT_URL of the test branch. Nothing happens if it is up to date.
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env })
}
