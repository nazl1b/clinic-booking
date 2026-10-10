// Reason for the visit: required for online and phone appointments, never on blocked time.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createUser, inDays, insertAppointment, loginAs, prisma, setHours } from './helpers.js'

type Agent = Awaited<ReturnType<typeof loginAs>>
const DAY = inDays(8) // a future day
const REASON_REQUIRED = 'Please choose a reason for the visit.'
let doctor: Awaited<ReturnType<typeof createUser>>
let doctorAgent: Agent
let admin: Agent
let patient: Agent

beforeAll(async () => {
  doctor = await createUser({ role: 'doctor' })
  doctorAgent = await loginAs(doctor.email)
  admin = await loginAs((await createUser({ role: 'admin' })).email)
  patient = await loginAs((await createUser({ role: 'patient' })).email)
})

beforeEach(async () => {
  await prisma.appointment.deleteMany()
  await setHours(doctor.id, DAY, [['09:00', '12:00', 30]])
})

const book = (body: object) => patient.post('/api/appointments').send({ doctorId: doctor.id, date: DAY, time: '09:00', ...body })
const phone = (agent: Agent, body: object) =>
  agent.post(agent === admin ? '/api/admin/appointments' : '/api/doctor/appointments').send({
    kind: 'manual',
    doctorId: doctor.id,
    date: DAY,
    time: '10:00',
    guestName: 'Phone Patient',
    guestPhone: '+30 690 000 0000',
    ...body,
  })
const block = (body: object = {}) => doctorAgent.post('/api/doctor/appointments').send({ kind: 'block', date: DAY, time: '11:00', durationMinutes: 30, ...body })

describe('patient booking', () => {
  it('saves the reason and the optional note', async () => {
    const res = await book({ reason: 'test_results', note: '  Blood tests  ' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ reason: 'test_results', note: 'Blood tests' })

    const withoutNote = await book({ time: '09:30', reason: 'first_visit' })
    expect(withoutNote.status).toBe(201)
    expect(withoutNote.body).toMatchObject({ reason: 'first_visit', note: null })
  })

  it('requires a reason', async () => {
    for (const reason of [undefined, null, '']) {
      const res = await book({ reason })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe(REASON_REQUIRED)
    }
    expect(await prisma.appointment.count()).toBe(0)
  })

  it('refuses a reason that is not one of the values', async () => {
    for (const reason of ['First visit', 'first visit', 'emergency', 1]) {
      const res = await book({ reason })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe(REASON_REQUIRED)
    }
    expect(await prisma.appointment.count()).toBe(0)
  })
})

describe('phone appointment', () => {
  it('saves the reason, for the doctor and the admin', async () => {
    const byDoctor = await phone(doctorAgent, { reason: 'follow_up' })
    expect(byDoctor.status).toBe(201)
    expect(byDoctor.body).toMatchObject({ kind: 'manual', reason: 'follow_up', note: null })

    const byAdmin = await phone(admin, { time: '10:30', reason: 'other', note: 'Medical certificate' })
    expect(byAdmin.status).toBe(201)
    expect(byAdmin.body).toMatchObject({ kind: 'manual', reason: 'other', note: 'Medical certificate' })
  })

  it('requires a valid reason', async () => {
    for (const agent of [doctorAgent, admin]) {
      for (const reason of [undefined, '', 'check-up']) {
        const res = await phone(agent, { reason })
        expect(res.status).toBe(400)
        expect(res.body.error).toBe(REASON_REQUIRED)
      }
    }
    expect(await prisma.appointment.count()).toBe(0)
  })
})

describe('blocked time', () => {
  it('needs no reason', async () => {
    const res = await block({ note: 'Lunch break' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ kind: 'block', reason: null, note: 'Lunch break' })
  })

  it('never stores a reason, even if one is sent', async () => {
    const res = await block({ reason: 'check_up' })
    expect(res.status).toBe(201)
    expect(res.body.reason).toBeNull()
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: res.body.id } })).reason).toBeNull()
  })

  it('the database refuses a block with a reason', async () => {
    const created = await insertAppointment({ doctorId: doctor.id, date: DAY, time: '11:00', kind: 'block' })
    await expect(prisma.appointment.update({ where: { id: created.id }, data: { reason: 'other' } })).rejects.toThrow()
  })
})

describe('appointments from before reasons existed', () => {
  it('are listed with reason null', async () => {
    const patientUser = await createUser({ role: 'patient' })
    const patientOfOld = await loginAs(patientUser.email)
    await insertAppointment({ doctorId: doctor.id, date: DAY, time: '09:00', patientId: patientUser.id })
    await insertAppointment({ doctorId: doctor.id, date: DAY, time: '09:30', kind: 'manual', guestName: 'Old Guest', guestPhone: '6970000000' })

    const mine = await patientOfOld.get('/api/appointments/mine?view=upcoming')
    expect(mine.status).toBe(200)
    expect(mine.body.items).toEqual([expect.objectContaining({ reason: null })])

    const list = await doctorAgent.get('/api/doctor/appointments')
    expect(list.status).toBe(200)
    expect(list.body.items.map((a: { reason: unknown }) => a.reason)).toEqual([null, null])
  })
})
