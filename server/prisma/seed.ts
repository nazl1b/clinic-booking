// Seed: the first admin (ADMIN_EMAIL / ADMIN_PASSWORD) and, only when
// SEED_DEMO_PASSWORD is set, demo doctors, patients, working hours and appointments.
// The demo data mirrors the client's mock data (client/src/api/mock/db.ts).
// Safe to run more than once: existing users are left as they are, and demo
// working hours / appointments are only added when they are missing.
import '../src/env.js'
import bcrypt from 'bcrypt'
import { prisma } from '../src/db.js'
import type { AppointmentKind, AppointmentStatus, Role } from '../src/generated/prisma/client.js'

const BCRYPT_ROUNDS = 12

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set in server/.env`)
  return value
}

// ---------- Dates in clinic time ----------

const timeZone = requireEnv('CLINIC_TIMEZONE')

// "YYYY-MM-DD" of today in the clinic's time zone (the server itself runs in UTC).
function clinicToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

// Next date (from tomorrow on) that falls on the given weekday.
function nextWeekday(day: number, weeksAhead = 0): string {
  let date = addDays(clinicToday(), 1)
  while (dayOfWeek(date) !== day) date = addDays(date, 1)
  return addDays(date, weeksAhead * 7)
}

// Prisma maps DATE and TIME columns to Date objects in UTC.
const dateValue = (date: string) => new Date(`${date}T00:00:00Z`)
const timeValue = (time: string) => new Date(`1970-01-01T${time}:00Z`)

// ---------- Users ----------

async function upsertUser(user: { name: string; email: string; role: Role; specialty?: string; isActive?: boolean }, password: string) {
  const email = user.email.toLowerCase()
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: user.name,
      email,
      role: user.role,
      specialty: user.specialty ?? null,
      isActive: user.isActive ?? true,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    },
  })
}

async function seedAdmin() {
  const admin = await upsertUser({ name: 'Clinic Admin', email: requireEnv('ADMIN_EMAIL'), role: 'admin' }, requireEnv('ADMIN_PASSWORD'))
  console.log(`Admin: ${admin.email}`)
}

// ---------- Demo data ----------

async function seedDemo(password: string) {
  const doctor = async (name: string, email: string, specialty: string, isActive = true) =>
    (await upsertUser({ name, email, role: 'doctor', specialty, isActive }, password)).id
  const patient = async (name: string, email: string) => (await upsertUser({ name, email, role: 'patient' }, password)).id

  const maria = await doctor('Dr. Maria Papadopoulou', 'maria@clinic.test', 'Cardiology')
  const nikos = await doctor('Dr. Nikos Georgiou', 'nikos@clinic.test', 'Dermatology')
  const eleni = await doctor('Dr. Eleni Ioannou', 'eleni@clinic.test', 'Pediatrics', false)
  const john = await patient('John Smith', 'john@example.com')
  const anna = await patient('Anna Lee', 'anna@example.com')
  const patients = [
    john,
    anna,
    await patient('Maria Kosta', 'maria.kosta@example.com'),
    await patient('Petros Alexiou', 'petros@example.com'),
    await patient('Sofia Nikolaou', 'sofia.n@example.com'),
    await patient('Giannis Markou', 'giannis.m@example.com'),
  ]

  // Working hours, only for doctors that have none yet.
  const windows: [doctorId: number, day: number, start: string, end: string, slotMinutes: number][] = [
    // Maria: every day, morning and afternoon/evening, 30-minute slots.
    // Wider than a real clinic on purpose, so booking can be tried at any time of day.
    ...[0, 1, 2, 3, 4, 5, 6].flatMap((day): [number, number, string, string, number][] => [
      [maria, day, '08:00', '14:00', 30],
      [maria, day, '15:00', '23:00', 30],
    ]),
    // Nikos: Mon/Wed afternoons, Sat morning, 20-minute slots
    [nikos, 1, '16:00', '20:00', 20],
    [nikos, 3, '16:00', '20:00', 20],
    [nikos, 6, '10:00', '13:00', 20],
    // Eleni (inactive)
    [eleni, 2, '09:00', '13:00', 30],
  ]
  for (const doctorId of [maria, nikos, eleni]) {
    if (await prisma.availability.count({ where: { doctorId } })) continue
    await prisma.availability.createMany({
      data: windows
        .filter(([id]) => id === doctorId)
        .map(([, dayOfWeek, start, end, slotMinutes]) => ({
          doctorId,
          dayOfWeek,
          startTime: timeValue(start),
          endTime: timeValue(end),
          slotMinutes,
        })),
    })
  }

  // Appointments, only if the demo doctors have none yet.
  if (await prisma.appointment.count({ where: { doctorId: { in: [maria, nikos, eleni] } } })) {
    console.log('Demo appointments already exist, skipped')
    return
  }

  type Row = {
    doctorId: number
    kind: AppointmentKind
    patientId?: number
    guestName?: string
    guestPhone?: string
    note?: string
    createdBy: number
    date: string
    time: string
    durationMinutes: number
    status?: AppointmentStatus
  }
  const online = (doctorId: number, patientId: number, date: string, time: string, durationMinutes: number, extra: Partial<Row> = {}): Row =>
    ({ doctorId, kind: 'online', patientId, createdBy: patientId, date, time, durationMinutes, ...extra })
  const manual = (guestName: string, guestPhone: string, date: string, time: string, note?: string): Row =>
    ({ doctorId: maria, kind: 'manual', guestName, guestPhone, note, createdBy: maria, date, time, durationMinutes: 30 })
  const block = (note: string, date: string, time: string, durationMinutes: number): Row =>
    ({ doctorId: maria, kind: 'block', note, createdBy: maria, date, time, durationMinutes })

  const today = clinicToday()
  const tue = nextWeekday(2)
  const wed = nextWeekday(3)
  const rows: Row[] = [
    // Maria's day today, spread over morning and afternoon so the schedule always
    // has past, upcoming, phone, blocked and cancelled entries whatever the time.
    online(maria, john, today, '09:00', 30, { note: 'Follow-up, blood pressure' }),
    online(maria, anna, today, '10:00', 30),
    manual('Katerina Vlachou', '+30 694 123 4567', today, '11:00', 'First visit'),
    block('Hospital rounds', today, '12:00', 60),
    online(maria, anna, today, '16:00', 30, { status: 'cancelled' }),
    manual('Dimitris Kostas', '+30 697 555 0192', today, '17:30'),
    online(maria, john, today, '19:00', 30, { note: 'Annual check-up' }),

    online(maria, john, tue, '09:30', 30),
    online(maria, anna, tue, '10:00', 30),
    manual('George Pappas', '+30 690 000 0001', tue, '11:00'),
    block('Lunch break', tue, '12:00', 60),
    online(nikos, john, wed, '16:20', 20),
    online(maria, john, nextWeekday(4), '09:00', 30, { status: 'cancelled' }),
    // Past appointment, kept as history
    online(maria, john, addDays(today, -7), '10:00', 30),
    // Future appointments of the inactive doctor were cancelled when she was deactivated
    online(eleni, anna, nextWeekday(2, 1), '09:00', 30, { status: 'cancelled' }),
  ]

  // Enough history and future bookings to page through the appointment lists.
  // Repeating pattern over the days around today; times never overlap the rows above.
  const guests: [string, string][] = [
    ['Eleni Papadaki', '+30 693 111 2233'],
    ['Kostas Lambrou', '+30 698 444 5566'],
    ['Maria Sotiriou', '+30 697 222 7788'],
    ['Nikos Daskalakis', '+30 694 909 1010'],
  ]
  // Nikos: Monday 17:00, Wednesday 18:00, Saturday 10:40 (inside his working hours)
  const nikosTimes: Record<number, string> = { 1: '17:00', 3: '18:00', 6: '10:40' }
  for (let offset = -10; offset <= 20; offset++) {
    if (offset === 0) continue
    const date = addDays(today, offset)
    const i = offset + 10

    // Maria: one online booking every day, a phone booking every third day,
    // a short block every ninth day; every seventh booking was cancelled.
    const time = ['08:00', '13:30', '18:00', '20:00'][i % 4]
    rows.push(online(maria, patients[i % patients.length], date, time, 30, i % 7 === 3 ? { status: 'cancelled' } : {}))
    if (i % 3 === 0) {
      const [guestName, guestPhone] = guests[i % guests.length]
      rows.push(manual(guestName, guestPhone, date, i % 2 ? '21:00' : '15:00'))
    }
    if (i % 9 === 0) rows.push(block('Admin time', date, '08:30', 30))

    const nikosTime = nikosTimes[dayOfWeek(date)]
    if (nikosTime) rows.push(online(nikos, patients[(i + 2) % patients.length], date, nikosTime, 20))
  }

  await prisma.appointment.createMany({
    data: rows.map((row) => ({ ...row, date: dateValue(row.date), time: timeValue(row.time) })),
  })
  console.log(`Demo data: 3 doctors, ${patients.length} patients, ${rows.length} appointments`)
}

async function main() {
  await seedAdmin()
  const demoPassword = process.env.SEED_DEMO_PASSWORD
  if (demoPassword) await seedDemo(demoPassword)
  else console.log('SEED_DEMO_PASSWORD is not set, demo data skipped')
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
