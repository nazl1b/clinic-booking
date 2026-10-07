// On the public demo (PROTECT_DEMO_ACCOUNTS=true) the shared demo accounts keep their
// password. In its own file: the forgot-password limit (5 per 15 minutes) starts fresh.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createToken } from '../src/services/tokens.js'
import { app, createUser, loginAs, outbox, PASSWORD, prisma, request } from './helpers.js'

const FORGOT_MESSAGE = 'If this email exists, we sent you a link to reset your password.'

describe('demo accounts on the public demo (PROTECT_DEMO_ACCOUNTS=true)', () => {
  beforeAll(() => {
    process.env.PROTECT_DEMO_ACCOUNTS = 'true'
  })
  afterAll(() => {
    delete process.env.PROTECT_DEMO_ACCOUNTS
  })

  it('cannot change their password', async () => {
    const demo = await createUser({ role: 'patient', email: 'demo.patient@example.com' })
    const agent = await loginAs(demo.email)

    const res = await agent.patch('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass-1' })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('The password of a demo account cannot be changed.')
    await loginAs(demo.email) // the old password still works
  })

  it('get no reset link, with the usual answer', async () => {
    const demo = await createUser({ role: 'doctor', email: 'demo.doctor@clinic.test' })

    const res = await request(app).post('/api/auth/forgot-password').send({ email: demo.email })
    expect(res.status).toBe(200)
    expect(res.body.message).toBe(FORGOT_MESSAGE)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    expect(outbox.some((e) => e.to === demo.email)).toBe(false)
    expect(await prisma.passwordReset.count({ where: { userId: demo.id } })).toBe(0)
  })

  it('cannot use a reset link made before', async () => {
    const demo = await createUser({ role: 'patient', email: 'old.link@example.org' })
    const { token, tokenHash } = createToken()
    await prisma.passwordReset.create({ data: { userId: demo.id, tokenHash, expiresAt: new Date(Date.now() + 3_600_000) } })

    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'brand-new-pass-1' })).status).toBe(400)
  })

  it('other accounts are not affected', async () => {
    const real = await createUser({ role: 'patient', email: 'real.person@gmail.com' })
    const agent = await loginAs(real.email)

    const res = await agent.patch('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass-1' })
    expect(res.status).toBe(204)
  })
})
