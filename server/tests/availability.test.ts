// Weekly working hours: PUT /api/doctor/availability refuses hours that overlap
// or repeat on the same day; GET returns them by day and start time.
import { beforeAll, describe, expect, it } from 'vitest'
import { createUser, loginAs } from './helpers.js'

type Agent = Awaited<ReturnType<typeof loginAs>>
let doctor: Agent

beforeAll(async () => {
  doctor = await loginAs((await createUser({ role: 'doctor' })).email)
})

const hours = (dayOfWeek: number, startTime: string, endTime: string, slotMinutes = 30) => ({ dayOfWeek, startTime, endTime, slotMinutes })
const save = (windows: object[]) => doctor.put('/api/doctor/availability').send(windows)

describe('working hours on the same day', () => {
  it('refuses hours that overlap', async () => {
    const res = await save([hours(1, '09:00', '14:00'), hours(1, '13:00', '17:00')])
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Working hours on the same day overlap.')
  })

  it('refuses the same hours twice', async () => {
    const res = await save([hours(1, '09:00', '14:00'), hours(1, '09:00', '14:00')])
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Working hours on the same day overlap.')
  })

  it('refuses hours inside other hours', async () => {
    expect((await save([hours(1, '09:00', '14:00'), hours(1, '10:00', '11:00')])).status).toBe(400)
  })

  it('accepts hours that only touch, and the same hours on different days', async () => {
    expect((await save([hours(1, '12:00', '14:00'), hours(1, '09:00', '12:00'), hours(2, '09:00', '12:00')])).status).toBe(204)
    const saved = await doctor.get('/api/doctor/availability')
    expect(saved.body).toEqual([hours(1, '09:00', '12:00'), hours(1, '12:00', '14:00'), hours(2, '09:00', '12:00')])
  })

  it('refuses an end before the start, or hours shorter than one appointment', async () => {
    expect((await save([hours(3, '14:00', '09:00')])).body.error).toBe('Start time must be before end time.')
    expect((await save([hours(3, '09:00', '09:20')])).body.error).toBe('Working hours must be at least one appointment long.')
  })

  it('a refused schedule leaves the saved one as it was', async () => {
    await save([hours(4, '09:00', '12:00')])
    expect((await save([hours(4, '09:00', '12:00'), hours(4, '11:00', '13:00')])).status).toBe(400)
    expect((await doctor.get('/api/doctor/availability')).body).toEqual([hours(4, '09:00', '12:00')])
  })
})
