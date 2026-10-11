// Appointment lists: server-side search, filters and pages of 20 (10 for the patient's own).
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

describe('cancelled blocked time', () => {
  it('is never listed, whatever the filters', async () => {
    const blocks = await createUser({ role: 'doctor' })
    const agent = await loginAs(blocks.email)
    await insertAppointment({ doctorId: blocks.id, date: inDays(12), time: '09:00', kind: 'block', status: 'cancelled' })
    await insertAppointment({ doctorId: blocks.id, date: inDays(12), time: '10:00', kind: 'block' })
    await insertAppointment({ doctorId: blocks.id, date: inDays(12), time: '11:00', kind: 'manual', guestName: 'Cancelled Guest', guestPhone: '6970000001', status: 'cancelled' })

    const times = async (query: string) => ((await agent.get(`/api/doctor/appointments${query}`)).body.items as { time: string }[]).map((a) => a.time)
    expect(await times('')).toEqual(['10:00', '11:00'])
    expect(await times('?status=cancelled')).toEqual(['11:00'])
    expect(await times('?kind=block')).toEqual(['10:00'])
    expect(await times('?kind=block&status=cancelled')).toEqual([])
    expect((await admin.get(`/api/admin/appointments?doctor=${blocks.id}`)).body.total).toBe(2)
  })
})

describe("the patient's own lists", () => {
  let patient: Awaited<ReturnType<typeof createUser>>
  let agent: Agent

  beforeAll(async () => {
    patient = await createUser({ role: 'patient' })
    agent = await loginAs(patient.email)
    // 12 upcoming and active, 3 upcoming but cancelled, 8 past (one of them cancelled).
    const upcoming = Array.from({ length: 15 }, (_, i) => ({ date: inDays(20 + i), status: i < 12 ? ('active' as const) : ('cancelled' as const) }))
    const past = Array.from({ length: 8 }, (_, i) => ({ date: inDays(-1 - i), status: i === 0 ? ('cancelled' as const) : ('active' as const) }))
    await prisma.appointment.createMany({
      data: [...upcoming, ...past].map(({ date, status }) => ({
        doctorId: other.id,
        kind: 'online' as const,
        patientId: patient.id,
        createdBy: patient.id,
        date: dateToDb(date),
        time: timeToDb('09:00'),
        durationMinutes: 30,
        status,
      })),
    })
    // Another patient's appointment is never listed.
    const stranger = await createUser({ role: 'patient' })
    await insertAppointment({ doctorId: other.id, date: inDays(20), time: '10:00', patientId: stranger.id })
  })

  it('upcoming: active ones only, soonest first, pages of 10', async () => {
    const page1 = await agent.get('/api/appointments/mine?view=upcoming')
    expect(page1.status).toBe(200)
    expect(page1.body).toMatchObject({ page: 1, pageSize: 10, total: 12 })
    expect(page1.body.items).toHaveLength(10)
    expect(page1.body.items[0].date).toBe(inDays(20))

    const page2 = await agent.get('/api/appointments/mine?view=upcoming&page=2')
    expect(page2.body.items.map((a: { date: string }) => a.date)).toEqual([inDays(30), inDays(31)])
    expect(page2.body.items.every((a: { status: string }) => a.status === 'active')).toBe(true)
  })

  it('past: past and cancelled ones, latest first', async () => {
    const page1 = await agent.get('/api/appointments/mine?view=past')
    expect(page1.body).toMatchObject({ page: 1, pageSize: 10, total: 11 })
    const dates = page1.body.items.map((a: { date: string }) => a.date)
    expect(dates.slice(0, 3)).toEqual([inDays(34), inDays(33), inDays(32)]) // the cancelled upcoming ones
    expect(dates[3]).toBe(inDays(-1))

    const page2 = await agent.get('/api/appointments/mine?view=past&page=2')
    expect(page2.body.items.map((a: { date: string }) => a.date)).toEqual([inDays(-8)])
  })

  it('needs a valid view and page', async () => {
    expect((await agent.get('/api/appointments/mine')).status).toBe(400)
    expect((await agent.get('/api/appointments/mine?view=all')).status).toBe(400)
    expect((await agent.get('/api/appointments/mine?view=past&page=0')).status).toBe(400)
  })
})
