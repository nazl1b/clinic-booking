import express, { type ErrorRequestHandler } from 'express'

export const app = express()

// Render sits in front of the server as a proxy.
// Without this, the secure session cookie is not set and logins do not persist online.
app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Any /api route not matched above
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Client errors (e.g. invalid JSON body) keep their 4xx status.
// Everything else is a 500 and its details stay in the server log.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = Number(err?.status ?? err?.statusCode)
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: err.expose ? err.message : 'Invalid request' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong' })
}
app.use(errorHandler)
