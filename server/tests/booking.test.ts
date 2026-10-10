import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createUser, inDays, insertAppointment, loginAs, prisma, setHours } from './helpers.js'

type Agent = Awaited<ReturnType<typeof loginAs>>
const DAY = inDays(8) // a future day
let doctor: Awaited<ReturnType<typeof createUser>>
let doctorAgent: Agent
let patient: Agent

beforeAll(async () => {
  doctor = await createUser({ role: 'doctor', name: 'Dr Booking' })
  doctorAgent = await loginAs(doctor.email)
  patient = await loginAs((await createUser({ role: 'patient' })).email)
})

beforeEach(async () => {
  await prisma.appointment.deleteMany()
  await setHours(doctor.id, DAY, [['09:00', '12:00', 30]])
})

const book = (time: string, date = DAY, doctorId = doctor.id) => patient.post('/api/appointments').send({ doctorId, date, time, reason: 'follow_up' })
const freeTimes = async () => ((await patient.get(`/api/doctors/${doctor.id}/slots?date=${DAY}`)).body as { time: string }[]).map((s) => s.time)

describe('booking', () => {
  it('books a free slot; the length comes from the working hours', async () => {
    const res = await patient.post('/api/appointments').send({ doctorId: doctor.id, date: DAY, time: '09:30', reason: 'check_up', durationMinutes: 300 })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ kind: 'online', date: DAY, time: '09:30', durationMinutes: 30, status: 'active', doctorName: 'Dr Booking' })
    expect(await freeTimes()).not.toContain('09:30')
  })

  it('refuses a double booking with 409', async () => {
    expect((await book('10:00')).status).toBe(201)
    const second = await book('10:00')
    expect(second.status).toBe(409)
    expect(second.body.error).toBe('This time slot was just booked. Please choose another one.')
  })

  it('lets exactly one of several simultaneous bookings through', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => book('11:00')))
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409])
    expect(await prisma.appointment.count({ where: { status: 'active' } })).toBe(1)
  })

  it('refuses times outside the working hours or the slot grid', async () => {
    expect((await book('03:00')).status).toBe(400) // the clinic is closed
    expect((await book('12:00')).status).toBe(400) // the hours end at 12:00
    expect((await book('09:10')).status).toBe(400) // not a 30-minute slot
    expect((await book('09:00', inDays(9))).status).toBe(400) // a day without hours
  })

  it('refuses past times', async () => {
    const yesterday = inDays(-1)
    await setHours(doctor.id, yesterday, [['00:00', '23:30', 30]])
    expect((await book('10:00', yesterday)).status).toBe(400)
  })

  it('refuses a deactivated doctor', async () => {
    const inactive = await createUser({ role: 'doctor', isActive: false })
    await setHours(inactive.id, DAY, [['09:00', '12:00', 30]])
    expect((await book('09:00', DAY, inactive.id)).status).toBe(400)
  })

  it('a cancelled appointment frees its slot', async () => {
    const res = await book('09:00')
    expect((await patient.patch(`/api/appointments/${res.body.id}/cancel`)).status).toBe(204)
    expect(await freeTimes()).toContain('09:00')
    expect((await book('09:00')).status).toBe(201)
  })
})

describe('overlaps', () => {
  it('keeps an appointment blocking its whole length after the slot length changes', async () => {
    expect((await book('10:00')).status).toBe(201) // holds 10:00–10:30

    // The doctor switches to 20-minute appointments.
    const hours = await doctorAgent.put('/api/doctor/availability').send([{ dayOfWeek: new Date(`${DAY}T00:00:00Z`).getUTCDay(), startTime: '09:00', endTime: '12:00', slotMinutes: 20 }])
    expect(hours.status).toBe(204)

    const times = await freeTimes()
    expect(times).not.toContain('10:00')
    expect(times).not.toContain('10:20') // 10:20–10:40 overlaps 10:00–10:30
    expect(times).toContain('10:40')
    expect((await book('10:20')).status).toBe(409)
    expect((await book('10:40')).status).toBe(201)
  })

  it('a phone appointment closes the slot for online booking', async () => {
    const phone = await doctorAgent
      .post('/api/doctor/appointments')
      .send({ kind: 'manual', date: DAY, time: '11:00', guestName: 'Phone Patient', guestPhone: '+30 690 000 0000', reason: 'first_visit' })
    expect(phone.status).toBe(201)

    expect(await freeTimes()).not.toContain('11:00')
    expect((await book('11:00')).status).toBe(409)
  })

  it('a blocked period closes every slot it covers', async () => {
    await insertAppointment({ doctorId: doctor.id, date: DAY, time: '09:00', kind: 'block', durationMinutes: 60 })
    const times = await freeTimes()
    expect(times).not.toContain('09:00')
    expect(times).not.toContain('09:30')
    expect(times).toContain('10:00')
  })
})
