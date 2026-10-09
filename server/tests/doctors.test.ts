// Doctor profile pages and bios: GET /api/doctors/:id, the admin's edit and the
// doctor's own PATCH /api/doctor/profile.
import { beforeAll, describe, expect, it } from 'vitest'
import { BIO_MAX_LENGTH } from '../src/schemas/common.js'
import { createUser, loginAs, prisma } from './helpers.js'

const TOO_LONG = `The bio is too long (at most ${BIO_MAX_LENGTH} characters).`
let admin: Awaited<ReturnType<typeof loginAs>>
let patient: Awaited<ReturnType<typeof loginAs>>

beforeAll(async () => {
  admin = await loginAs((await createUser({ role: 'admin' })).email)
  patient = await loginAs((await createUser({ role: 'patient' })).email)
})

describe('doctor profile page', () => {
  it('patients see an active doctor with their bio', async () => {
    const doctor = await createUser({ role: 'doctor', name: 'Dr. Profile', specialty: 'Cardiology' })
    await prisma.user.update({ where: { id: doctor.id }, data: { bio: 'Twenty years of heart care.' } })

    const res = await patient.get(`/api/doctors/${doctor.id}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: doctor.id, name: 'Dr. Profile', specialty: 'Cardiology', bio: 'Twenty years of heart care.' })
    expect((await patient.get('/api/doctors')).body.find((d: { id: number }) => d.id === doctor.id).bio).toBe('Twenty years of heart care.')
  })

  it('a doctor without a bio has bio null', async () => {
    const doctor = await createUser({ role: 'doctor' })
    expect((await patient.get(`/api/doctors/${doctor.id}`)).body.bio).toBeNull()
  })

  it('deactivated, unknown and non-doctor ids are 404', async () => {
    const inactive = await createUser({ role: 'doctor', isActive: false })
    const someone = await createUser({ role: 'patient' })
    for (const id of [inactive.id, someone.id, 999999, 'abc']) {
      const res = await patient.get(`/api/doctors/${id}`)
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Doctor not found.')
    }
  })

  it('is for patients only', async () => {
    const doctor = await createUser({ role: 'doctor' })
    expect((await admin.get(`/api/doctors/${doctor.id}`)).status).toBe(403)
  })
})

describe('admin edits a bio', () => {
  it('saves, clears and keeps the bio', async () => {
    const doctor = await createUser({ role: 'doctor', name: 'Dr. Edit', specialty: 'Neurology' })
    const url = `/api/admin/doctors/${doctor.id}`

    const saved = await admin.patch(url).send({ name: 'Dr. Edit', specialty: 'Neurology', bio: '  Headache specialist.  ' })
    expect(saved.status).toBe(200)
    expect(saved.body.bio).toBe('Headache specialist.') // trimmed

    // Without bio (e.g. an older client) the bio stays as it is.
    expect((await admin.patch(url).send({ name: 'Dr. Edited', specialty: 'Neurology' })).body).toMatchObject({ name: 'Dr. Edited', bio: 'Headache specialist.' })

    // Empty text removes it.
    expect((await admin.patch(url).send({ name: 'Dr. Edited', specialty: 'Neurology', bio: '   ' })).body.bio).toBeNull()
  })

  it('refuses a bio that is too long', async () => {
    const doctor = await createUser({ role: 'doctor' })
    const res = await admin.patch(`/api/admin/doctors/${doctor.id}`).send({ name: 'Dr. Long', specialty: 'Neurology', bio: 'x'.repeat(BIO_MAX_LENGTH + 1) })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe(TOO_LONG)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: doctor.id } })).bio).toBeNull()
  })
})

describe('doctor edits their own bio', () => {
  it('saves it and returns the updated user', async () => {
    const doctor = await createUser({ role: 'doctor' })
    const agent = await loginAs(doctor.email)

    const res = await agent.patch('/api/doctor/profile').send({ bio: 'Happy to help.' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: doctor.id, role: 'doctor', bio: 'Happy to help.' })
    expect((await agent.get('/api/auth/me')).body.bio).toBe('Happy to help.')

    expect((await agent.patch('/api/doctor/profile').send({ bio: null })).body.bio).toBeNull()
  })

  it('checks the length and the type', async () => {
    const agent = await loginAs((await createUser({ role: 'doctor' })).email)

    const long = await agent.patch('/api/doctor/profile').send({ bio: 'x'.repeat(BIO_MAX_LENGTH + 1) })
    expect(long.status).toBe(400)
    expect(long.body.error).toBe(TOO_LONG)
    expect((await agent.patch('/api/doctor/profile').send({ bio: 42 })).status).toBe(400)
    expect((await agent.patch('/api/doctor/profile').send({ bio: 'x'.repeat(BIO_MAX_LENGTH) })).status).toBe(200)
  })

  it('only doctors can use it', async () => {
    expect((await patient.patch('/api/doctor/profile').send({ bio: 'Not a doctor.' })).status).toBe(403)
  })
})
