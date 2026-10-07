import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type ErrorRequestHandler } from 'express'
import { HttpError } from './errors.js'
import { loadUser } from './middleware/auth.js'
import { adminRouter } from './routes/admin.js'
import { appointmentsRouter } from './routes/appointments.js'
import { authRouter } from './routes/auth.js'
import { cronRouter } from './routes/cron.js'
import { doctorRouter } from './routes/doctor.js'
import { doctorsRouter } from './routes/doctors.js'
import { invitationsRouter } from './routes/invitations.js'
import { sessionMiddleware } from './session.js'

export const app = express()

// Render sits in front of the server as a proxy.
// Without this, the secure session cookie is not set and logins do not persist online.
app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Called by the cron service with a secret key, not a session.
app.use('/api/cron', cronRouter)

// Every other /api route knows who is logged in (req.user), if anyone.
app.use('/api', sessionMiddleware, loadUser)

app.use('/api/auth', authRouter)
app.use('/api/doctor', doctorRouter)
app.use('/api/doctors', doctorsRouter)
app.use('/api/appointments', appointmentsRouter)
app.use('/api/invitations', invitationsRouter)
app.use('/api/admin', adminRouter)

// Any /api route not matched above
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Online, Express also serves the built React app (client/dist): page and API share
// one domain, so the session cookie works without CORS.
// In development Vite serves the client instead.
const clientDist = fileURLToPath(new URL('../../client/dist/', import.meta.url))
if (process.env.NODE_ENV === 'production') {
  if (!existsSync(join(clientDist, 'index.html'))) console.warn(`The client is not built: ${clientDist} has no index.html`)
  // Built files carry a content hash in their name, so they can be cached for a year.
  app.use('/assets', express.static(join(clientDist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }))
  app.use(express.static(clientDist, { index: false }))
  // Any other path is a page of the React app (React Router): always the latest index.html.
  app.get('/{*path}', (_req, res) => {
    res.set('Cache-Control', 'no-cache')
    res.sendFile(join(clientDist, 'index.html'))
  })
}

// Client errors (e.g. invalid JSON body) keep their 4xx status, and an HttpError
// keeps its status and message (e.g. 502 when an email could not be sent).
// Everything else is a 500 and its details stay in the server log.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    if (err.status >= 500) console.error(err.cause ?? err)
    res.status(err.status).json({ error: err.message })
    return
  }
  const status = Number(err?.status ?? err?.statusCode)
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: err.expose ? err.message : 'Invalid request' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong' })
}
app.use(errorHandler)
