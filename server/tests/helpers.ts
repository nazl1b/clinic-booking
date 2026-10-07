import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'
import type { Role } from '../src/generated/prisma/client.js'
import { hashPassword } from '../src/services/passwords.js'
import { addDays, clinicNow, dateToDb, dayOfWeek, timeToDb } from '../src/utils/dates.js'
import { outbox } from './outbox.js'

export { app, prisma, request }

export const PASSWORD = 'test-password-1'

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE users, invitations, password_resets, availability, appointments, session RESTART IDENTITY CASCADE',
  )
  outbox.length = 0
}

// bcrypt is slow on purpose, so every test user shares one hash of PASSWORD.
let passwordHash: Promise<string> | undefined
let counter = 0

export async function createUser(options: { role: Role; name?: string; email?: string; isActive?: boolean; specialty?: string }) {
  counter++
  return prisma.user.create({
    data: {
      role: options.role,
      name: options.name ?? `${options.role} ${counter}`,
      email: options.email ?? `${options.role}${counter}@example.test`,
      specialty: options.role === 'doctor' ? (options.specialty ?? 'General practice') : null,
      isActive: options.isActive ?? true,
      passwordHash: await (passwordHash ??= hashPassword(PASSWORD)),
    },
  })
}

// A logged-in "browser": a supertest agent keeps the session cookie between requests.
export async function loginAs(email: string, password = PASSWORD) {
  const agent = request.agent(app)
  const res = await agent.post('/api/auth/login').send({ email, password })
  if (res.status !== 200) throw new Error(`login ${email} -> ${res.status} ${res.body.error}`)
  return agent
}

// ---------- dates in clinic time ----------

export const today = () => clinicNow().date
// A future date `days` from today, e.g. far enough to never be "past" during a test.
export const inDays = (days: number) => addDays(today(), days)

// Weekly hours of a doctor on the weekday of `date`, e.g. [['09:00', '12:00', 30]].
export async function setHours(doctorId: number, date: string, windows: [start: string, end: string, slotMinutes: number][]) {
  await prisma.availability.deleteMany({ where: { doctorId, dayOfWeek: dayOfWeek(date) } })
  await prisma.availability.createMany({
    data: windows.map(([start, end, slotMinutes]) => ({ doctorId, dayOfWeek: dayOfWeek(date), startTime: timeToDb(start), endTime: timeToDb(end), slotMinutes })),
  })
}

// Inserts an appointment directly (no checks), for setting up a test.
export function insertAppointment(data: {
  doctorId: number
  date: string
  time: string
  kind?: 'online' | 'manual' | 'block'
  patientId?: number
  guestName?: string
  guestPhone?: string
  durationMinutes?: number
  status?: 'active' | 'cancelled'
}) {
  const kind = data.kind ?? 'online'
  return prisma.appointment.create({
    data: {
      doctorId: data.doctorId,
      kind,
      patientId: data.patientId ?? null,
      guestName: data.guestName ?? null,
      guestPhone: data.guestPhone ?? null,
      createdBy: data.patientId ?? data.doctorId,
      date: dateToDb(data.date),
      time: timeToDb(data.time),
      durationMinutes: data.durationMinutes ?? 30,
      status: data.status ?? 'active',
    },
  })
}

// ---------- emails ----------

// Emails can be sent in the background (e.g. forgot password), so wait a little.
export async function waitForEmail(to: string, subject: string) {
  for (let i = 0; i < 50; i++) {
    const email = outbox.findLast((e) => e.to === to && e.subject === subject)
    if (email) return email
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`no email "${subject}" to ${to}`)
}

// The token from a link like https://…/reset-password?token=abc
export function tokenFromEmail(email: { text: string }, path: string): string {
  const match = email.text.match(new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`))
  if (!match) throw new Error(`no ${path} link in the email`)
  return match[1]
}

export { outbox }
