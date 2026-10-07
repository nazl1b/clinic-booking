// The four emails the app sends (ARCHITECTURE.md section 12), each as text and HTML.
// Wording follows the client's mock emails. Names come from users, so every value
// put into the HTML is escaped.
import { formatDate } from '../utils/dates.js'
import type { Email } from './email.js'

type Template = Omit<Email, 'to'>

export const INVITATION_HOURS = 48
export const PASSWORD_RESET_HOURS = 1

// Public address of the app, e.g. http://localhost:5173 locally.
function appLink(path: string): string {
  const appUrl = process.env.APP_URL
  if (!appUrl) throw new Error('APP_URL is not set')
  return new URL(path, appUrl).toString()
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const SIGNATURE = 'Clinic Booking'

// One simple layout for every email: greeting, paragraphs and an optional button.
function render(subject: string, content: { name: string; paragraphs: string[]; button?: { label: string; url: string } }): Template {
  const { name, paragraphs, button } = content
  const text = [`Hello ${name},`, ...paragraphs, ...(button ? [`${button.label}: ${button.url}`] : []), SIGNATURE].join('\n\n')

  const p = (inner: string) => `<p style="margin:0 0 16px">${inner}</p>`
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;line-height:1.5">
${p(`Hello ${escapeHtml(name)},`)}
${paragraphs.map((paragraph) => p(escapeHtml(paragraph))).join('\n')}
${
  button
    ? p(`<a href="${escapeHtml(button.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px">${escapeHtml(button.label)}</a>`) +
      p(`<span style="font-size:13px;color:#52606d">Or copy this link: ${escapeHtml(button.url)}</span>`)
    : ''
}
<p style="margin:0;color:#52606d">${escapeHtml(SIGNATURE)}</p>
</div>
</body></html>`

  return { subject, text, html }
}


export function invitationEmail(input: { name: string; token: string }): Template {
  return render('You are invited to join the clinic', {
    name: input.name,
    paragraphs: [`You have been invited to join the clinic as a doctor. Open this link within ${INVITATION_HOURS} hours to set your password.`],
    button: { label: 'Set your password', url: appLink(`/accept-invite?token=${encodeURIComponent(input.token)}`) },
  })
}

export function passwordResetEmail(input: { name: string; token: string }): Template {
  return render('Reset your password', {
    name: input.name,
    paragraphs: [
      `Use this link within ${PASSWORD_RESET_HOURS} hour to set a new password.`,
      'If you did not ask for this, you can ignore this email. Your password will not change.',
    ],
    button: { label: 'Reset password', url: appLink(`/reset-password?token=${encodeURIComponent(input.token)}`) },
  })
}

// date: "YYYY-MM-DD", time: "HH:MM", both in clinic time.
interface AppointmentDetails {
  patientName: string
  doctorName: string
  date: string
  time: string
}

export function reminderEmail(input: AppointmentDetails): Template {
  return render('Reminder: your appointment tomorrow', {
    name: input.patientName,
    paragraphs: [`This is a reminder of your appointment with ${input.doctorName} tomorrow, ${formatDate(input.date)} at ${input.time}.`],
    button: { label: 'View my appointments', url: appLink('/appointments') },
  })
}

// reason, e.g. "Please book another time." or "The doctor is no longer available at the clinic."
export function cancellationEmail(input: AppointmentDetails & { reason: string }): Template {
  return render('Your appointment was cancelled', {
    name: input.patientName,
    paragraphs: [`Your appointment with ${input.doctorName} on ${formatDate(input.date)} at ${input.time} was cancelled. ${input.reason}`],
    button: { label: 'Book another appointment', url: appLink('/doctors') },
  })
}
