// Seed: the first admin (ADMIN_EMAIL / ADMIN_PASSWORD) and, only when
// SEED_DEMO_PASSWORD is set, demo doctors, patients, working hours and appointments.
// The demo data mirrors the client's mock data (client/src/api/mock/db.ts).
// Safe to run more than once (Render runs it on every deploy): existing users are
// left as they are, a demo doctor's bio is only written while it is empty or an
// earlier text of this seed, and demo working hours / appointments are only added
// when they are missing.
import '../src/env.js'
import { hashPassword } from '../src/services/passwords.js'
import { prisma } from '../src/db.js'
import { dateToDb, timeToDb } from '../src/utils/dates.js'
import type { AppointmentKind, AppointmentStatus, Role } from '../src/generated/prisma/client.js'

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
      passwordHash: await hashPassword(password),
    },
  })
}

async function seedAdmin() {
  const admin = await upsertUser({ name: 'Clinic Admin', email: requireEnv('ADMIN_EMAIL'), role: 'admin' }, requireEnv('ADMIN_PASSWORD'))
  console.log(`Admin: ${admin.email}`)
}

// ---------- Demo data ----------

// Bios of the demo doctors, by email. The seed writes a bio only while it is
// empty or still an earlier text of this seed (PREVIOUS_BIOS), so a new text here
// also reaches existing databases, but never replaces a bio written by the admin
// or the doctor. When you change a bio, add its old text to PREVIOUS_BIOS.
const BIOS: Record<string, string> = {
  'maria@clinic.test':
    'Dr. Maria Papadopoulou is a cardiologist with 18 years of experience in preventing and treating heart disease, high blood pressure and high cholesterol. She studied medicine at the University of Athens and completed her cardiology training at Hammersmith Hospital in London. Her visits include a full heart check with an ECG and, when needed, an echocardiogram. She takes time to explain the results and builds a treatment plan that fits daily life. She speaks Greek and English.',
  'nikos@clinic.test':
    'Dr. Nikos Georgiou is a dermatologist who treats skin, hair and nail conditions in adults and teenagers, from acne and eczema to psoriasis and hair loss. He studied at the Aristotle University of Thessaloniki and trained in dermatology at Andreas Syngros Hospital in Athens. He has 12 years of experience. He also offers mole checks with dermoscopy for the early detection of skin cancer. He speaks Greek, English and German.',
  'andreas@clinic.test':
    'Dr. Andreas Christou is a cardiologist specialising in heart rhythm problems and sports cardiology. He studied medicine at the University of Patras and trained in electrophysiology at the Charité in Berlin. For the past 10 years he has screened athletes of all levels before competition. He also follows up patients with palpitations or atrial fibrillation. He speaks Greek, English and German.',
  'katerina@clinic.test':
    'Dr. Katerina Vasileiou is a paediatrician who cares for children from birth to 16 years old. She studied at the University of Crete and trained at the Aglaia Kyriakou Children\'s Hospital in Athens. In 14 years of practice she has focused on developmental check-ups, vaccinations and advice on nutrition and sleep. Parents are always welcome to bring their questions. She speaks Greek, English and French.',
  'dimitris@clinic.test':
    'Dr. Dimitris Antoniou is an orthopaedic surgeon who treats knee, shoulder and back pain, with a special interest in sports injuries. He studied at the University of Ioannina and completed a fellowship in arthroscopic surgery in Lyon. He has 16 years of experience and works closely with physiotherapists. Surgery is only suggested when other treatments have not helped. He speaks Greek, English and French.',
  'sofia@clinic.test':
    'Dr. Sofia Karamanli is an ophthalmologist who examines and treats eye conditions such as dry eye, glaucoma and cataracts. She studied at the National and Kapodistrian University of Athens and trained at Moorfields Eye Hospital in London. Over 11 years she has looked after patients of all ages, from children\'s first eye tests to cataract follow-up. Her visits include a full eye exam and, when needed, a prescription for glasses or contact lenses. She speaks Greek and English.',
  'petros@clinic.test':
    'Dr. Petros Nikolaidis is a general practitioner and often the first stop for adults with a new health concern. He studied at the Aristotle University of Thessaloniki and trained in general practice in Edinburgh. In 20 years of practice he has handled check-ups, chronic conditions such as diabetes and asthma, and referrals to specialists when they are needed. He believes in prevention and clear, practical advice. He speaks Greek, English and Italian.',
  'ioanna@clinic.test':
    'Dr. Ioanna Pappa is a neurologist who sees patients with headaches, migraines, dizziness and nerve pain. She studied at the University of Athens and trained in neurology at the University Hospitals Leuven in Belgium. She has 13 years of experience and a particular interest in long-term care for epilepsy and multiple sclerosis. She works closely with each patient\'s family doctor. She speaks Greek, English and Dutch.',
  'eleni@clinic.test':
    'Dr. Eleni Ioannou is a paediatrician with a focus on allergies and asthma in children. She studied at the University of Thessaly and trained in paediatric allergy in Vienna. She has 9 years of experience. She helps families manage food allergies, eczema and asthma at home and at school. She speaks Greek, English and German.',
}

// Texts this seed wrote before, by email: safe to replace with the current one.
const PREVIOUS_BIOS: Record<string, string[]> = {
  'maria@clinic.test': [
    'Dr. Papadopoulou is a cardiologist with over 15 years of experience in heart disease prevention and high blood pressure. She trained at the University of Athens and Hammersmith Hospital in London. Her visits focus on clear explanations and a treatment plan that fits daily life.',
  ],
  'nikos@clinic.test': [
    'Dr. Georgiou treats skin, hair and nail conditions in adults and teenagers, from acne and eczema to psoriasis. He also offers mole checks for early detection of skin cancer.',
  ],
  'andreas@clinic.test': [
    'Dr. Christou is a cardiologist specialising in heart rhythm problems and sports cardiology. He sees athletes of all levels for pre-participation screening and follows up patients with palpitations or atrial fibrillation.',
  ],
  'katerina@clinic.test': [
    'Dr. Vasileiou cares for children from birth to 16 years old. She offers developmental check-ups, vaccinations and advice on nutrition and sleep. Parents are always welcome to bring their questions.',
  ],
  'dimitris@clinic.test': [
    'Dr. Antoniou is an orthopaedic surgeon who treats knee, shoulder and back pain. He has a special interest in sports injuries and works closely with physiotherapists. Surgery is only suggested when other treatments have not helped.',
  ],
  'sofia@clinic.test': [
    'Dr. Karamanli examines and treats eye conditions such as dry eye, glaucoma and cataracts. Her visits include a full eye exam and, when needed, a prescription for glasses or contact lenses.',
  ],
  'petros@clinic.test': [
    'Dr. Nikolaidis is a general practitioner and often the first stop for adults with a new health concern. He handles check-ups, chronic conditions such as diabetes, and referrals to specialists when they are needed.',
  ],
  'ioanna@clinic.test': [
    'Dr. Pappa is a neurologist who sees patients with headaches, migraines, dizziness and nerve pain. She has a particular interest in long-term care for epilepsy and multiple sclerosis.',
  ],
  'eleni@clinic.test': [
    'Dr. Ioannou is a paediatrician with a focus on allergies and asthma in children.',
  ],
}

async function seedDemo(password: string) {
  const doctor = async (name: string, email: string, specialty: string, isActive = true) => {
    const { id } = await upsertUser({ name, email, role: 'doctor', specialty, isActive }, password)
    // Only an empty bio or one this seed wrote before, never one the admin or the doctor wrote.
    const bio = BIOS[email]
    if (bio) {
      await prisma.user.updateMany({
        where: { id, OR: [{ bio: null }, { bio: { in: PREVIOUS_BIOS[email] ?? [] } }] },
        data: { bio },
      })
    }
    return id
  }
  const patient = async (name: string, email: string) => (await upsertUser({ name, email, role: 'patient' }, password)).id

  const maria = await doctor('Dr. Maria Papadopoulou', 'maria@clinic.test', 'Cardiology')
  const nikos = await doctor('Dr. Nikos Georgiou', 'nikos@clinic.test', 'Dermatology')
  const eleni = await doctor('Dr. Eleni Ioannou', 'eleni@clinic.test', 'Pediatrics', false)
  // More doctors for the doctor list (two cardiologists, so the specialty filter has a group).
  // They have working hours but no demo appointments.
  const andreas = await doctor('Dr. Andreas Christou', 'andreas@clinic.test', 'Cardiology')
  const katerina = await doctor('Dr. Katerina Vasileiou', 'katerina@clinic.test', 'Pediatrics')
  const dimitris = await doctor('Dr. Dimitris Antoniou', 'dimitris@clinic.test', 'Orthopedics')
  const sofia = await doctor('Dr. Sofia Karamanli', 'sofia@clinic.test', 'Ophthalmology')
  const petros = await doctor('Dr. Petros Nikolaidis', 'petros@clinic.test', 'General Practice')
  const ioanna = await doctor('Dr. Ioanna Pappa', 'ioanna@clinic.test', 'Neurology')
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

  // Working hours, only for doctors that have none yet. Like a real clinic:
  // mornings 09:00–14:00, some evenings 17:00–20:00, Saturday mornings, closed on Sunday.
  type Window = [doctorId: number, day: number, start: string, end: string, slotMinutes: number]
  const MON_FRI = [1, 2, 3, 4, 5]
  const hours = (doctorId: number, days: number[], start: string, end: string, slotMinutes: number): Window[] =>
    days.map((day) => [doctorId, day, start, end, slotMinutes])
  const windows: Window[] = [
    // Maria: weekday mornings and evenings, Saturday morning, 30-minute slots
    ...hours(maria, MON_FRI, '09:00', '14:00', 30),
    ...hours(maria, MON_FRI, '17:00', '20:00', 30),
    ...hours(maria, [6], '09:00', '13:00', 30),
    // Nikos: Mon/Wed/Fri mornings, Tue/Thu evenings, 20-minute slots
    ...hours(nikos, [1, 3, 5], '09:00', '14:00', 20),
    ...hours(nikos, [2, 4], '17:00', '20:00', 20),
    // Eleni (inactive)
    ...hours(eleni, [2], '09:00', '13:00', 30),
    // Andreas: weekday mornings, Wednesday evening, 30-minute slots
    ...hours(andreas, MON_FRI, '09:00', '14:00', 30),
    ...hours(andreas, [3], '17:00', '20:00', 30),
    // Katerina: weekday mornings, Mon/Wed evenings, 20-minute slots
    ...hours(katerina, MON_FRI, '09:00', '14:00', 20),
    ...hours(katerina, [1, 3], '17:00', '20:00', 20),
    // Dimitris: Tue/Thu mornings and evenings, Saturday morning, 30-minute slots
    ...hours(dimitris, [2, 4], '09:00', '14:00', 30),
    ...hours(dimitris, [2, 4], '17:00', '20:00', 30),
    ...hours(dimitris, [6], '09:00', '13:00', 30),
    // Sofia: Mon/Wed/Fri mornings, 15-minute slots
    ...hours(sofia, [1, 3, 5], '09:00', '14:00', 15),
    // Petros: weekday mornings, Tue/Thu evenings, Saturday morning, 15-minute slots
    ...hours(petros, MON_FRI, '09:00', '14:00', 15),
    ...hours(petros, [2, 4], '17:00', '20:00', 15),
    ...hours(petros, [6], '09:00', '13:00', 15),
    // Ioanna: Wednesday morning, Mon/Thu evenings, 45-minute slots
    ...hours(ioanna, [3], '09:00', '14:00', 45),
    ...hours(ioanna, [1, 4], '17:00', '20:00', 45),
  ]
  for (const doctorId of [maria, nikos, eleni, andreas, katerina, dimitris, sofia, petros, ioanna]) {
    if (await prisma.availability.count({ where: { doctorId } })) continue
    await prisma.availability.createMany({
      data: windows
        .filter(([id]) => id === doctorId)
        .map(([, dayOfWeek, start, end, slotMinutes]) => ({
          doctorId,
          dayOfWeek,
          startTime: timeToDb(start),
          endTime: timeToDb(end),
          slotMinutes,
        })),
    })
  }

  // Appointments, only if the first demo doctors have none yet (the newer doctors get none).
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
    // Maria's day today, spread over morning and evening so the schedule always
    // has past, upcoming, phone, blocked and cancelled entries whatever the time
    // (on a weekend they fall outside her working hours; they are still shown).
    online(maria, john, today, '09:00', 30, { note: 'Follow-up, blood pressure' }),
    online(maria, anna, today, '10:00', 30),
    manual('Katerina Vlachou', '+30 694 123 4567', today, '11:00', 'First visit'),
    block('Hospital rounds', today, '12:00', 60),
    online(maria, anna, today, '13:00', 30, { status: 'cancelled' }),
    manual('Dimitris Kostas', '+30 697 555 0192', today, '17:30'),
    online(maria, john, today, '19:00', 30, { note: 'Annual check-up' }),

    online(maria, john, tue, '09:30', 30),
    online(maria, anna, tue, '10:00', 30),
    manual('George Pappas', '+30 690 000 0001', tue, '11:00'),
    block('Lunch break', tue, '12:00', 60),
    online(nikos, john, wed, '10:20', 20),
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
  // Nikos: Monday 10:00, Wednesday 11:20, Thursday 17:40 (inside his working hours)
  const nikosTimes: Record<number, string> = { 1: '10:00', 3: '11:20', 4: '17:40' }
  for (let offset = -10; offset <= 20; offset++) {
    if (offset === 0) continue
    const date = addDays(today, offset)
    const weekday = dayOfWeek(date)
    const i = offset + 10

    // Maria (closed on Sunday): one online booking every day, a phone booking
    // every third day, a short block every ninth day; every seventh booking was
    // cancelled. Inside her hours, and never at the times of the rows above.
    if (weekday !== 0) {
      const saturday = weekday === 6
      const time = (saturday ? ['09:30', '10:30', '12:00', '12:30'] : ['13:30', '17:00', '18:00', '19:30'])[i % 4]
      rows.push(online(maria, patients[i % patients.length], date, time, 30, i % 7 === 3 ? { status: 'cancelled' } : {}))
      if (i % 3 === 0) {
        const [guestName, guestPhone] = guests[i % guests.length]
        rows.push(manual(guestName, guestPhone, date, saturday ? '11:00' : i % 2 ? '11:30' : '18:30'))
      }
      if (i % 9 === 0) rows.push(block('Admin time', date, '09:00', 30))
    }

    const nikosTime = nikosTimes[weekday]
    if (nikosTime) rows.push(online(nikos, patients[(i + 2) % patients.length], date, nikosTime, 20))
  }

  await prisma.appointment.createMany({
    data: rows.map((row) => ({ ...row, date: dateToDb(row.date), time: timeToDb(row.time) })),
  })
  console.log(`Demo data: 9 doctors, ${patients.length} patients, ${rows.length} appointments`)
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
