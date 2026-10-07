import { describe, expect, it } from 'vitest'
import { app, createUser, loginAs, PASSWORD, prisma, request } from './helpers.js'

describe('register, login, logout, me', () => {
  it('registers a patient and logs them in', async () => {
    const agent = request.agent(app)
    const res = await agent.post('/api/auth/register').send({ name: '  Anna Test ', email: ' Anna@Example.TEST ', password: 'long-enough-1' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Anna Test', email: 'anna@example.test', role: 'patient', specialty: null, isActive: true })
    expect(res.body).not.toHaveProperty('passwordHash')
    expect(res.headers['set-cookie']?.[0]).toMatch(/HttpOnly/)

    const me = await agent.get('/api/auth/me')
    expect(me.status).toBe(200)
    expect(me.body.id).toBe(res.body.id)
  })

  it('refuses an email that is already registered, whatever its case', async () => {
    await createUser({ role: 'patient', email: 'taken@example.test' })
    const res = await request(app).post('/api/auth/register').send({ name: 'X', email: 'TAKEN@example.test', password: 'long-enough-1' })
    expect(res.status).toBe(409)
  })

  it('validates the registration data', async () => {
    const shortPassword = await request(app).post('/api/auth/register').send({ name: 'X', email: 'x@example.test', password: 'short' })
    expect(shortPassword.status).toBe(400)
    expect(shortPassword.body.error).toBe('Password must be at least 8 characters.')

    const badEmail = await request(app).post('/api/auth/register').send({ name: 'X', email: 'not-an-email', password: 'long-enough-1' })
    expect(badEmail.status).toBe(400)
  })

  it('gives the same answer for an unknown email and a wrong password', async () => {
    const user = await createUser({ role: 'patient' })
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.test', password: PASSWORD })
    const wrong = await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' })

    expect(unknown.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(unknown.body.error).toBe(wrong.body.error)
  })

  it('logs in with any email case and logs out', async () => {
    const user = await createUser({ role: 'doctor' })
    const agent = await loginAs(user.email.toUpperCase())
    expect((await agent.get('/api/auth/me')).body.role).toBe('doctor')

    expect((await agent.post('/api/auth/logout')).status).toBe(204)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })

  it('refuses a deactivated account', async () => {
    const doctor = await createUser({ role: 'doctor', isActive: false })
    const res = await request(app).post('/api/auth/login').send({ email: doctor.email, password: PASSWORD })
    expect(res.status).toBe(403)
  })

  it('logs a user out at once when they are deactivated', async () => {
    const doctor = await createUser({ role: 'doctor' })
    const agent = await loginAs(doctor.email)
    await prisma.user.update({ where: { id: doctor.id }, data: { isActive: false } })

    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })
})

describe('roles', () => {
  // One endpoint per role group.
  const endpoints = {
    patient: '/api/appointments/mine',
    doctor: '/api/doctor/availability',
    admin: '/api/admin/doctors',
  } as const

  it('needs a login for every protected group', async () => {
    for (const path of Object.values(endpoints)) {
      expect((await request(app).get(path)).status, path).toBe(401)
    }
  })

  it('lets each role use only its own endpoints', async () => {
    for (const role of ['patient', 'doctor', 'admin'] as const) {
      const agent = await loginAs((await createUser({ role })).email)
      for (const [group, path] of Object.entries(endpoints)) {
        expect((await agent.get(path)).status, `${role} → ${path}`).toBe(group === role ? 200 : 403)
      }
    }
  })
})
