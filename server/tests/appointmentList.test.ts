// Appointment lists: server-side search, filters and pages of 20 (ARCHITECTURE.md section 10).
import { beforeAll, describe, expect, it } from 'vitest'
import { dateToDb, fromMinutes, timeToDb } from '../src/utils/dates.js'
import { createUser, inDays, insertAppointment, loginAs, prisma } from './helpers.js'

type Agent = Awaited<ReturnType<typeof loginAs>>
let mine: Awaited<ReturnType<typeof createUser>>
let other: Awaited<ReturnType<typeof createUser>>
let doctor: Agent
let admin: Agent

beforeAll(async () => {
  mine = await createUser({ role: 'doctor' })
  other = await createUser({ role: 'doctor' })
  const zelda = await createUser({ role: 'patient', name: 'Zelda Searchable' })
  doctor = await loginAs(mine.email)
  admin = await loginAs((await createUser({ role: 'admin' })).email)

  // 45 appointments for `mine` over 3 days (15 a day, every 30 minutes from 08:00):
  // online for Zelda, every 5th cancelled.
  await prisma.appointment.createMany({
    data: Array.from({ length: 45 }, (_, i) => ({
      doctorId: mine.id,
      kind: 'online' as const,
      patientId: zelda.id,
      createdBy: zelda.id,
      date: dateToDb(inDays(10 + Math.floor(i / 15))),
      time: timeToDb(fromMinutes(8 * 60 + (i % 15) * 30)),
      durationMinutes: 30,
      status: i % 5 === 0 ? ('cancelled' as const) : ('active' as const),
    })),
  })
  await insertAppointment({ doctorId: mine.id, date: inDays(9), time: '09:00', kind: 'manual', guestName: 'Katerina Phone', guestPhone: '+30 694 123 4567' })
  for (const time of ['09:00', '09:30', '10:00']) await insertAppointment({ doctorId: other.id, date: inDays(10), time, kind: 'manual', guestName: 'Other Guest', guestPhone: '6970000000' })
})

describe('pagination', () => {
  it('returns pages of 20 with the total', async () => {
    const page1 = await doctor.get('/api/doctor/appointments')
    expect(page1.status).toBe(200)
    expect(page1.body).toMatchObject({ page: 1, pageSize: 20, total: 46 })
    expect(page1.body.items).toHaveLength(20)

    const page3 = await doctor.get('/api/doctor/appointments?page=3')
    expect(page3.body.items).toHaveLength(6)
    expect((await doctor.get('/api/doctor/appointments?page=4')).body.items).toHaveLength(0)
  })

  it('pages do not overlap and follow date and time', async () => {
    const all = []
    for (const page of [1, 2, 3]) all.push(...(await doctor.get(`/api/doctor/appointments?page=${page}`)).body.items)
    const keys = all.map((a: { date: string; time: string; id: number }) => `${a.date} ${a.time} ${a.id}`)
    expect(new Set(keys).size).toBe(46)
    expect(keys).toEqual([...keys].sort())
  })

  it('accepts a page size up to 100', async () => {
    expect((await doctor.get('/api/doctor/appointments?pageSize=100')).body.items).toHaveLength(46)
    expect((await doctor.get('/api/doctor/appointments?pageSize=101')).status).toBe(400)
    expect((await doctor.get('/api/doctor/appointments?page=0')).status).toBe(400)
  })
})

describe('filters and search', () => {
  it('filters by status, kind and dates', async () => {
    expect((await doctor.get('/api/doctor/appointments?status=cancelled')).body.total).toBe(9)
    expect((await doctor.get('/api/doctor/appointments?kind=manual')).body.total).toBe(1)
    expect((await doctor.get(`/api/doctor/appointments?from=${inDays(10)}&to=${inDays(10)}`)).body.total).toBe(15)
    expect((await doctor.get('/api/doctor/appointments?status=unknown')).status).toBe(400)
  })

  it('searches patient names and phone numbers by digits', async () => {
    expect((await doctor.get('/api/doctor/appointments?search=zelda')).body.total).toBe(45)
    expect((await doctor.get('/api/doctor/appointments?search=6941234567')).body.total).toBe(1)
    expect((await doctor.get('/api/doctor/appointments?search=%25')).body.total).toBe(0) // "%" is not a wildcard
  })

  it('a doctor sees only their own appointments, whatever they send', async () => {
    const res = await doctor.get(`/api/doctor/appointments?doctor=${other.id}&pageSize=100`)
    expect(res.body.total).toBe(46)
    expect(res.body.items.every((a: { doctorId: number }) => a.doctorId === mine.id)).toBe(true)
  })

  it('the admin sees every doctor, or one with ?doctor=', async () => {
    expect((await admin.get('/api/admin/appointments')).body.total).toBe(49)
    expect((await admin.get(`/api/admin/appointments?doctor=${other.id}`)).body.total).toBe(3)
  })
})
