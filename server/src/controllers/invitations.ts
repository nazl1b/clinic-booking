// Doctor invitations.
// The admin invites; the doctor opens the emailed link and sets their own password,
// so nobody else ever knows it. A link works once and expires after 48 hours.
import type { RequestHandler } from 'express'
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import { type Invitation, Prisma } from '../generated/prisma/client.js'
import { acceptInvitationSchema, invitationListSchema, invitationSchema } from '../schemas/admin.js'
import { DEFAULT_PAGE_SIZE } from '../schemas/common.js'
import { parse, parseId } from '../schemas/validate.js'
import { sendEmail } from '../services/email.js'
import { INVITATION_HOURS, invitationEmail } from '../services/emailTemplates.js'
import { hashPassword } from '../services/passwords.js'
import { createToken, hashToken } from '../services/tokens.js'
import { escapeLike } from '../utils/search.js'

const INVITATION_NOT_FOUND = 'Invitation not found.'
const INVALID_LINK = 'This invitation is invalid, has expired or has already been used.'
const USER_EXISTS = 'A user with this email already exists.'

function toInvitationJson(invitation: Invitation) {
  return {
    id: invitation.id,
    email: invitation.email,
    name: invitation.name,
    specialty: invitation.specialty,
    expiresAt: invitation.expiresAt.toISOString(),
  }
}

const newExpiry = () => new Date(Date.now() + INVITATION_HOURS * 3_600_000)

// The admin must know if the email did not leave, so this one is awaited.
async function emailInvitation(invitation: Invitation, token: string): Promise<void> {
  try {
    await sendEmail({ to: invitation.email, ...invitationEmail({ name: invitation.name, token }) })
  } catch (err) {
    throw new HttpError(502, 'The invitation email could not be sent. Please try again.', { cause: err })
  }
}

// ---------- admin: /api/admin/invitations ----------

// POST — 409 at once if the email already has an account or a pending invitation;
// nothing is sent then. Invitations for the same email wait for each other (lock),
// so two simultaneous requests cannot both create one.
export const createInvitation: RequestHandler = async (req, res) => {
  const { name, specialty, email } = parse(invitationSchema, req.body)
  const { token, tokenHash } = createToken()

  const invitation = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}::text))`
    if (await tx.user.findUnique({ where: { email } })) throw new HttpError(409, USER_EXISTS)
    const pending = await tx.invitation.findFirst({ where: { email, usedAt: null, expiresAt: { gt: new Date() } } })
    if (pending) throw new HttpError(409, 'There is already a pending invitation for this email.')
    await tx.invitation.deleteMany({ where: { email, usedAt: null } }) // expired ones, replaced by this one
    return tx.invitation.create({ data: { name, specialty, email, tokenHash, expiresAt: newExpiry(), invitedBy: req.user!.id } })
  })

  try {
    await emailInvitation(invitation, token)
  } catch (err) {
    await prisma.invitation.delete({ where: { id: invitation.id } })
    throw err
  }
  res.status(201).json(toInvitationJson(invitation))
}

// GET ?search=&page=&pageSize= — invitations not used yet, expired ones included so
// they can be resent; oldest first. One page (20 by default) and the total.
export const listInvitations: RequestHandler = async (req, res) => {
  const query = parse(invitationListSchema, req.query)
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE

  const filters: Prisma.InvitationWhereInput[] = [{ usedAt: null }]
  if (query.search) {
    const text = escapeLike(query.search)
    filters.push({
      OR: [
        { name: { contains: text, mode: 'insensitive' } },
        { specialty: { contains: text, mode: 'insensitive' } },
        { email: { contains: text, mode: 'insensitive' } },
      ],
    })
  }
  const where: Prisma.InvitationWhereInput = { AND: filters }

  const [total, invitations] = await prisma.$transaction([
    prisma.invitation.count({ where }),
    prisma.invitation.findMany({ where, orderBy: { id: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  res.json({ items: invitations.map(toInvitationJson), page, pageSize, total })
}

// POST /:id/resend — a new link valid for another 48 hours; the old link stops working.
export const resendInvitation: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id, INVITATION_NOT_FOUND)
  const current = await prisma.invitation.findFirst({ where: { id, usedAt: null } })
  if (!current) throw new HttpError(404, INVITATION_NOT_FOUND)
  if (await prisma.user.findUnique({ where: { email: current.email } })) throw new HttpError(409, USER_EXISTS)

  const { token, tokenHash } = createToken()
  const { count } = await prisma.invitation.updateMany({ where: { id, usedAt: null }, data: { tokenHash, expiresAt: newExpiry() } })
  if (count === 0) throw new HttpError(404, INVITATION_NOT_FOUND) // accepted in the meantime
  const invitation = await prisma.invitation.findUniqueOrThrow({ where: { id } })
  await emailInvitation(invitation, token)
  res.json(toInvitationJson(invitation))
}

// DELETE /:id — the link stops working.
export const deleteInvitation: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id, INVITATION_NOT_FOUND)
  const { count } = await prisma.invitation.deleteMany({ where: { id, usedAt: null } })
  if (count === 0) throw new HttpError(404, INVITATION_NOT_FOUND)
  res.status(204).end()
}

// ---------- invited doctor (no login): /api/invitations/:token ----------

// GET — who the invitation is for, if the link is still valid.
export const getInvitation: RequestHandler = async (req, res) => {
  const invitation = await prisma.invitation.findFirst({
    where: { tokenHash: hashToken(String(req.params.token)), usedAt: null, expiresAt: { gt: new Date() } },
  })
  if (!invitation) throw new HttpError(404, INVALID_LINK)
  res.json({ name: invitation.name, email: invitation.email, specialty: invitation.specialty })
}

// POST /accept — creates the doctor's account with the password they chose.
// The link is marked used and the account created in one transaction: of two
// simultaneous requests with the same link only one succeeds.
export const acceptInvitation: RequestHandler = async (req, res) => {
  const { password } = parse(acceptInvitationSchema, req.body)
  const passwordHash = await hashPassword(password)

  try {
    await prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { tokenHash: hashToken(String(req.params.token)) } })
      const { count } = invitation
        ? await tx.invitation.updateMany({ where: { id: invitation.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } })
        : { count: 0 }
      if (!invitation || count === 0) throw new HttpError(404, INVALID_LINK)
      await tx.user.create({
        data: { name: invitation.name, email: invitation.email, specialty: invitation.specialty, role: 'doctor', passwordHash },
      })
    })
  } catch (err) {
    // Someone registered with this email after the invitation was sent.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'An account with this email already exists.')
    }
    throw err
  }
  res.status(204).end()
}
