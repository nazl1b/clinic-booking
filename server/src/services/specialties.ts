// Specialties of the clinic: the ones doctors (active or not) and pending
// invitations already have. The admin picks one of them or types a new one;
// one typed in another letter case is saved the way it already exists.
import { prisma } from '../db.js'

// Doctors first, then pending invitations, oldest first: the first spelling of a
// specialty is the one that counts. `exceptDoctorId` leaves one doctor out.
async function knownSpecialties(exceptDoctorId?: number): Promise<string[]> {
  const [doctors, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'doctor', specialty: { not: null }, ...(exceptDoctorId !== undefined && { id: { not: exceptDoctorId } }) },
      select: { specialty: true },
      orderBy: { id: 'asc' },
    }),
    prisma.invitation.findMany({ where: { usedAt: null }, select: { specialty: true }, orderBy: { id: 'asc' } }),
  ])
  return [...doctors.map((d) => d.specialty!), ...invitations.map((i) => i.specialty)]
}

// Every specialty once, alphabetically (for the admin's suggestions).
export async function listSpecialties(): Promise<string[]> {
  const byKey = new Map<string, string>()
  for (const specialty of await knownSpecialties()) {
    const key = specialty.toLowerCase()
    if (!byKey.has(key)) byKey.set(key, specialty)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

// "cardiology" → "Cardiology" when that already exists; a new specialty stays as
// typed. `exceptDoctorId`: the doctor being edited, so they can change the letter
// case of a specialty that only they have.
export async function canonicalSpecialty(specialty: string, exceptDoctorId?: number): Promise<string> {
  const key = specialty.toLowerCase()
  return (await knownSpecialties(exceptDoctorId)).find((known) => known.toLowerCase() === key) ?? specialty
}
