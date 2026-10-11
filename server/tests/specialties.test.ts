// Specialties: the admin's suggestions (GET /api/admin/specialties), and a specialty
// typed in another letter case saved the way it already exists (invite and edit).
import { beforeAll, describe, expect, it } from 'vitest'
import { createUser, loginAs, prisma } from './helpers.js'

type Agent = Awaited<ReturnType<typeof loginAs>>
let admin: Agent

beforeAll(async () => {
  admin = await loginAs((await createUser({ role: 'admin' })).email)
  await createUser({ role: 'doctor', specialty: 'Cardiology' })
  await createUser({ role: 'doctor', specialty: 'Cardiology' })
  await createUser({ role: 'doctor', specialty: 'Dermatology', isActive: false })
})

const invite = (specialty: string, email: string) => admin.post('/api/admin/invitations').send({ name: 'Dr Invited', specialty, email })

describe('specialties', () => {
  it('lists the existing specialties once each, alphabetically, deactivated doctors and pending invitations included', async () => {
    expect((await invite('Neurology', 'neuro@example.test')).status).toBe(201)
    const res = await admin.get('/api/admin/specialties')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(['Cardiology', 'Dermatology', 'Neurology'])
  })

  it('an invitation with an existing specialty in other letters gets its spelling', async () => {
    const res = await invite('  cardiology ', 'cardio@example.test')
    expect(res.status).toBe(201)
    expect(res.body.specialty).toBe('Cardiology')
    expect((await invite('NEUROLOGY', 'neuro2@example.test')).body.specialty).toBe('Neurology') // from the pending invitation
    expect((await invite('Pulmonology', 'lungs@example.test')).body.specialty).toBe('Pulmonology') // a new one stays as typed
  })

  it('editing a doctor does the same', async () => {
    const doctor = await createUser({ role: 'doctor', specialty: 'Cardiology' })
    const res = await admin.patch(`/api/admin/doctors/${doctor.id}`).send({ name: doctor.name, specialty: 'dermatology' })
    expect(res.status).toBe(200)
    expect(res.body.specialty).toBe('Dermatology')
  })

  it('a doctor whose specialty nobody else has can change its letter case', async () => {
    const doctor = await createUser({ role: 'doctor', specialty: 'Allergology' })
    const res = await admin.patch(`/api/admin/doctors/${doctor.id}`).send({ name: doctor.name, specialty: 'ALLERGOLOGY' })
    expect(res.body.specialty).toBe('ALLERGOLOGY')
    expect((await prisma.user.findUniqueOrThrow({ where: { id: doctor.id } })).specialty).toBe('ALLERGOLOGY')
  })

  it('is for admins only', async () => {
    const doctor = await loginAs((await createUser({ role: 'doctor' })).email)
    expect((await doctor.get('/api/admin/specialties')).status).toBe(403)
  })
})
