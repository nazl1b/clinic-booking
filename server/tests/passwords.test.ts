import { describe, expect, it } from 'vitest'
import { createToken } from '../src/services/tokens.js'
import { app, createUser, loginAs, outbox, PASSWORD, prisma, request, tokenFromEmail, waitForEmail } from './helpers.js'

const FORGOT_MESSAGE = 'If this email exists, we sent you a link to reset your password.'

describe('forgot and reset password', () => {
  it('answers the same for any email but emails only an existing, active user', async () => {
    const user = await createUser({ role: 'patient' })
    const inactive = await createUser({ role: 'doctor', isActive: false })

    for (const email of [user.email, 'nobody@example.test', inactive.email]) {
      const res = await request(app).post('/api/auth/forgot-password').send({ email })
      expect(res.status).toBe(200)
      expect(res.body.message).toBe(FORGOT_MESSAGE)
    }
    await waitForEmail(user.email, 'Reset your password')
    expect(outbox.filter((e) => e.subject === 'Reset your password').map((e) => e.to)).toEqual([user.email])
  })

  it('sets a new password with the emailed link, once, and logs out every session', async () => {
    const user = await createUser({ role: 'patient' })
    const browserA = await loginAs(user.email)
    const browserB = await loginAs(user.email)

    await request(app).post('/api/auth/forgot-password').send({ email: user.email })
    const token = tokenFromEmail(await waitForEmail(user.email, 'Reset your password'), 'reset-password')

    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'brand-new-pass-1' })
    expect(res.status).toBe(204)
    expect((await browserA.get('/api/auth/me')).status).toBe(401)
    expect((await browserB.get('/api/auth/me')).status).toBe(401)
    await loginAs(user.email, 'brand-new-pass-1')

    const again = await request(app).post('/api/auth/reset-password').send({ token, password: 'another-pass-1' })
    expect(again.status).toBe(400)
  })

  it('refuses an expired link', async () => {
    const user = await createUser({ role: 'patient' })
    const { token, tokenHash } = createToken()
    await prisma.passwordReset.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() - 60_000) } })

    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'brand-new-pass-1' })
    expect(res.status).toBe(400)
  })

  it('stores only a hash of the token', async () => {
    const user = await createUser({ role: 'patient' })
    await request(app).post('/api/auth/forgot-password').send({ email: user.email })
    const token = tokenFromEmail(await waitForEmail(user.email, 'Reset your password'), 'reset-password')

    const rows = await prisma.passwordReset.findMany({ where: { userId: user.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].tokenHash).not.toBe(token)
  })
})

describe('change password', () => {
  it('needs the current password', async () => {
    const user = await createUser({ role: 'patient' })
    const agent = await loginAs(user.email)

    const res = await agent.patch('/api/auth/password').send({ currentPassword: 'wrong-password', newPassword: 'brand-new-pass-1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Your current password is incorrect.')
  })

  it('keeps the current session and logs out the others', async () => {
    const user = await createUser({ role: 'patient' })
    const current = await loginAs(user.email)
    const other = await loginAs(user.email)

    const res = await current.patch('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass-1' })
    expect(res.status).toBe(204)
    expect((await current.get('/api/auth/me')).status).toBe(200)
    expect((await other.get('/api/auth/me')).status).toBe(401)
    await loginAs(user.email, 'brand-new-pass-1')
  })

  it('needs a login', async () => {
    const res = await request(app).patch('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass-1' })
    expect(res.status).toBe(401)
  })
})
