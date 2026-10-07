import connectPgSimple from 'connect-pg-simple'
import session from 'express-session'
import { prisma } from './db.js'

declare module 'express-session' {
  interface SessionData {
    // The only thing kept in a session. The user itself is loaded from the
    // database on every request (middleware/auth.ts), so role and is_active are always current.
    userId: number
  }
}

const secret = process.env.SESSION_SECRET
if (!secret) throw new Error('SESSION_SECRET is not set')

const PgStore = connectPgSimple(session)

export const SESSION_COOKIE = 'sid'

export const sessionMiddleware = session({
  name: SESSION_COOKIE,
  secret,
  store: new PgStore({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    // The table is created by the Prisma migration, not by connect-pg-simple.
    createTableIfMissing: false,
    // Expired sessions are deleted every 15 minutes. Not in tests: the timer would
    // keep the test run alive after the last test.
    pruneSessionInterval: process.env.NODE_ENV === 'test' ? false : undefined,
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // Online the app is served over HTTPS (Render); locally it is plain http.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
})

// Logs a user out everywhere by deleting their sessions from the database,
// optionally keeping one (the session that made the request).
export function deleteUserSessions(userId: number, exceptSessionId?: string): Promise<number> {
  return exceptSessionId === undefined
    ? prisma.$executeRaw`DELETE FROM "session" WHERE ("sess"->>'userId')::int = ${userId}`
    : prisma.$executeRaw`DELETE FROM "session" WHERE ("sess"->>'userId')::int = ${userId} AND "sid" <> ${exceptSessionId}`
}
