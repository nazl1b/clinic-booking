// Runs before each test file.
import { beforeAll, vi } from 'vitest'
import { loadTestEnv } from './env.js'

loadTestEnv()

// No real emails: they are collected in tests/outbox.ts, where tests read the links.
vi.mock('../src/services/email.js', async () => {
  const { outbox } = await import('./outbox.js')
  return {
    sendEmail: async (email: (typeof outbox)[number]) => {
      outbox.push(email)
    },
  }
})

// Every test file starts from an empty database.
beforeAll(async () => {
  const { resetDatabase } = await import('./helpers.js')
  await resetDatabase()
})
