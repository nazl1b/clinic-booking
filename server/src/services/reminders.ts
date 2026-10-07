// Appointment reminders. An external service
// (cron-job.org) calls /api/cron/reminders once a day, because on Render's free
// plan the server sleeps and a timer inside the app would not run reliably.
import { prisma } from '../db.js'
import { addDays, clinicNow, dateFromDb, dateToDb, timeFromDb } from '../utils/dates.js'
import { sendEmail } from './email.js'
import { reminderEmail } from './emailTemplates.js'

const PARALLEL_EMAILS = 5

// Emails every patient with an active online appointment tomorrow (clinic time)
// that has not been reminded yet. Phone appointments have no email.
// Each appointment is marked reminded *before* its email is sent, and only if it
// was not marked already: two simultaneous runs can never email the same patient
// twice. If the email fails, the mark is removed so the next run tries again.
export async function sendReminders(): Promise<{ date: string; sent: number; failed: number }> {
  const tomorrow = addDays(clinicNow().date, 1)
  const appointments = await prisma.appointment.findMany({
    where: { date: dateToDb(tomorrow), kind: 'online', status: 'active', reminderSent: false },
    include: { doctor: { select: { name: true } }, patient: { select: { name: true, email: true } } },
    orderBy: [{ time: 'asc' }, { id: 'asc' }],
  })

  let sent = 0
  let failed = 0
  for (let i = 0; i < appointments.length; i += PARALLEL_EMAILS) {
    await Promise.all(
      appointments.slice(i, i + PARALLEL_EMAILS).map(async (appointment) => {
        const { count } = await prisma.appointment.updateMany({
          where: { id: appointment.id, reminderSent: false, status: 'active' },
          data: { reminderSent: true },
        })
        if (count === 0 || !appointment.patient) return // another run took it, or it was cancelled meanwhile

        try {
          await sendEmail({
            to: appointment.patient.email,
            ...reminderEmail({
              patientName: appointment.patient.name,
              doctorName: appointment.doctor.name,
              date: dateFromDb(appointment.date),
              time: timeFromDb(appointment.time),
            }),
          })
          sent++
        } catch (err) {
          failed++
          console.error(`Reminder for appointment ${appointment.id} failed:`, err)
          await prisma.appointment.update({ where: { id: appointment.id }, data: { reminderSent: false } })
        }
      }),
    )
  }
  return { date: tomorrow, sent, failed }
}
