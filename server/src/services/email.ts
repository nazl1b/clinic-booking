// The only place that sends email (ARCHITECTURE.md section 12).
// EMAIL_PROVIDER picks the service:
//   ethereal (default): fake inbox for development, nothing reaches anyone.
//                       Each email's preview link is printed to the console.
//   brevo:              real emails through Brevo's HTTP API (Render blocks SMTP).
// sendEmail throws if sending fails; each caller decides whether that fails the request.
import type { Transporter } from 'nodemailer'

export interface Email {
  to: string
  subject: string
  text: string
  html: string
}

const SENDER_NAME = 'Clinic Booking'

const provider = process.env.EMAIL_PROVIDER || 'ethereal'
if (provider !== 'ethereal' && provider !== 'brevo') {
  throw new Error(`EMAIL_PROVIDER must be "ethereal" or "brevo", not "${provider}"`)
}
if (provider === 'brevo' && (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM)) {
  throw new Error('EMAIL_PROVIDER=brevo needs BREVO_API_KEY and EMAIL_FROM')
}
const senderEmail = process.env.EMAIL_FROM || 'no-reply@clinic.test'

export async function sendEmail(email: Email): Promise<void> {
  if (provider === 'brevo') await sendWithBrevo(email)
  else await sendWithEthereal(email)
}

// ---------- Brevo ----------

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

async function sendWithBrevo(email: Email): Promise<void> {
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: senderEmail },
      to: [{ email: email.to }],
      subject: email.subject,
      textContent: email.text,
      htmlContent: email.html,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status !== 201) {
    // Brevo answers { code, message }; the API key is never part of it.
    const details = (await res.text()).slice(0, 300)
    throw new Error(`Brevo could not send "${email.subject}": ${res.status} ${details}`)
  }
}

// ---------- Ethereal ----------

// With ETHEREAL_USER / ETHEREAL_PASS every email lands in that one inbox
// (log in at ethereal.email to see them). Without them, a temporary inbox is
// created on the first email after each server start.
let etherealTransport: Promise<Transporter> | undefined

function getEtherealTransport(): Promise<Transporter> {
  etherealTransport ??= (async () => {
    const nodemailer = (await import('nodemailer')).default
    let user = process.env.ETHEREAL_USER
    let pass = process.env.ETHEREAL_PASS
    if (!user || !pass) {
      const account = await nodemailer.createTestAccount()
      ;({ user, pass } = account)
      console.log(`[email] Temporary Ethereal inbox: ${user}`)
    }
    return nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, auth: { user, pass } })
  })().catch((err: unknown) => {
    etherealTransport = undefined // try again on the next email
    throw err
  })
  return etherealTransport
}

async function sendWithEthereal(email: Email): Promise<void> {
  const transport = await getEtherealTransport()
  const info = await transport.sendMail({
    from: { name: SENDER_NAME, address: senderEmail },
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  })
  const nodemailer = (await import('nodemailer')).default
  console.log(`[email] "${email.subject}" to ${email.to}: ${nodemailer.getTestMessageUrl(info)}`)
}
