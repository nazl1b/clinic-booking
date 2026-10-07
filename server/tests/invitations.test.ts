import { beforeAll, describe, expect, it } from 'vitest'
import { app, createUser, loginAs, request, tokenFromEmail, waitForEmail } from './helpers.js'

const SUBJECT = 'You are invited to join the clinic'
let admin: Awaited<ReturnType<typeof loginAs>>

beforeAll(async () => {
  admin = await loginAs((await createUser({ role: 'admin' })).email)
})

async function invite(email: string) {
  return admin.post('/api/admin/invitations').send({ name: 'Dr Invited', specialty: 'Neurology', email })
}

describe('doctor invitations', () => {
  it('invited doctor sets their own password and logs in', async () => {
    const res = await invite('NEW.Doctor@example.test')
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ email: 'new.doctor@example.test', name: 'Dr Invited', specialty: 'Neurology' })

    const token = tokenFromEmail(await waitForEmail('new.doctor@example.test', SUBJECT), 'accept-invite')
    const preview = await request(app).get(`/api/invitations/${token}`)
    expect(preview.status).toBe(200)
    expect(preview.body).toEqual({ name: 'Dr Invited', email: 'new.doctor@example.test', specialty: 'Neurology' })

    expect((await request(app).post(`/api/invitations/${token}/accept`).send({ password: 'doctor-pass-1' })).status).toBe(204)
    const doctor = await loginAs('new.doctor@example.test', 'doctor-pass-1')
    expect((await doctor.get('/api/auth/me')).body).toMatchObject({ role: 'doctor', specialty: 'Neurology' })
  })

  it('a link works only once', async () => {
    await invite('once@example.test')
    const token = tokenFromEmail(await waitForEmail('once@example.test', SUBJECT), 'accept-invite')
    expect((await request(app).post(`/api/invitations/${token}/accept`).send({ password: 'doctor-pass-1' })).status).toBe(204)

    expect((await request(app).get(`/api/invitations/${token}`)).status).toBe(404)
    expect((await request(app).post(`/api/invitations/${token}/accept`).send({ password: 'doctor-pass-2' })).status).toBe(404)
  })

  it('refuses an email with an account or a pending invitation', async () => {
    const patient = await createUser({ role: 'patient' })
    expect((await invite(patient.email)).status).toBe(409)

    expect((await invite('pending@example.test')).status).toBe(201)
    expect((await invite('pending@example.test')).status).toBe(409)
  })

  it('resending replaces the link', async () => {
    const created = await invite('resend@example.test')
    const oldToken = tokenFromEmail(await waitForEmail('resend@example.test', SUBJECT), 'accept-invite')

    expect((await admin.post(`/api/admin/invitations/${created.body.id}/resend`)).status).toBe(200)
    const newToken = tokenFromEmail(await waitForEmail('resend@example.test', SUBJECT), 'accept-invite')

    expect(newToken).not.toBe(oldToken)
    expect((await request(app).get(`/api/invitations/${oldToken}`)).status).toBe(404)
    expect((await request(app).get(`/api/invitations/${newToken}`)).status).toBe(200)
  })

  it('only an admin can invite', async () => {
    const doctor = await loginAs((await createUser({ role: 'doctor' })).email)
    const res = await doctor.post('/api/admin/invitations').send({ name: 'X', specialty: 'Y', email: 'x@example.test' })
    expect(res.status).toBe(403)
  })
})
