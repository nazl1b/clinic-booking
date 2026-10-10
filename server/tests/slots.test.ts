// Who may see which free slots.
import { beforeAll, describe, expect, it } from 'vitest'
import { app, createUser, inDays, loginAs, request, setHours } from './helpers.js'

type Agent = Awaited<ReturnType<typeof loginAs>>
const DAY = inDays(8)
let active: Awaited<ReturnType<typeof createUser>>
let inactive: Awaited<ReturnType<typeof createUser>>
let patientUser: Awaited<ReturnType<typeof createUser>>
let patient: Agent
let doctor: Agent
let admin: Agent

beforeAll(async () => {
  active = await createUser({ role: 'doctor' })
  inactive = await createUser({ role: 'doctor', isActive: false })
  for (const id of [active.id, inactive.id]) await setHours(id, DAY, [['09:00', '11:00', 30]])
  patientUser = await createUser({ role: 'patient' })
  patient = await loginAs(patientUser.email)
  doctor = await loginAs(active.email)
  admin = await loginAs((await createUser({ role: 'admin' })).email)
})

const slots = (agent: Agent, doctorId: number, date = DAY) => agent.get(`/api/doctors/${doctorId}/slots?date=${date}`)

describe('free slots by role', () => {
  it('needs a login', async () => {
    expect((await request(app).get(`/api/doctors/${active.id}/slots?date=${DAY}`)).status).toBe(401)
  })

  it('patient: active doctors only', async () => {
    const res = await slots(patient, active.id)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { time: '09:00', durationMinutes: 30, windowEnd: '11:00' },
      { time: '09:30', durationMinutes: 30, windowEnd: '11:00' },
      { time: '10:00', durationMinutes: 30, windowEnd: '11:00' },
      { time: '10:30', durationMinutes: 30, windowEnd: '11:00' },
    ])
    expect((await slots(patient, inactive.id)).status).toBe(404)
  })

  it('doctor: own slots only', async () => {
    expect((await slots(doctor, active.id)).status).toBe(200)
    const other = await createUser({ role: 'doctor' })
    expect((await slots(doctor, other.id)).status).toBe(403)
  })

  it('admin: any doctor; a deactivated one has no slots', async () => {
    expect((await slots(admin, active.id)).body).toHaveLength(4)
    const res = await slots(admin, inactive.id)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('each slot says where its working window ends, also when two windows touch', async () => {
    const touching = await createUser({ role: 'doctor' })
    await setHours(touching.id, DAY, [['09:00', '10:00', 30], ['10:00', '11:00', 30]])
    const res = await slots(admin, touching.id)
    expect(res.body.map((s: { time: string; windowEnd: string }) => `${s.time}→${s.windowEnd}`)).toEqual(['09:00→10:00', '09:30→10:00', '10:00→11:00', '10:30→11:00'])
  })

  it('an id that is not a doctor is a 404', async () => {
    expect((await slots(admin, patientUser.id)).status).toBe(404)
    expect((await admin.get(`/api/doctors/abc/slots?date=${DAY}`)).status).toBe(404)
  })

  it('needs a real date; past days have no slots', async () => {
    expect((await admin.get(`/api/doctors/${active.id}/slots?date=2026-02-30`)).status).toBe(400)
    expect((await admin.get(`/api/doctors/${active.id}/slots`)).status).toBe(400)

    const yesterday = inDays(-1)
    await setHours(active.id, yesterday, [['00:00', '23:30', 30]])
    expect((await slots(admin, active.id, yesterday)).body).toEqual([])
  })
})
