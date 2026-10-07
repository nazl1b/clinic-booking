import { z } from 'zod'
import { emailSchema, newPasswordSchema } from './auth.js'

const INVITE = 'Please fill in name, specialty and a valid email.'

// POST /api/admin/invitations
export const invitationSchema = z.object(
  {
    name: z.string(INVITE).trim().min(1, INVITE).max(100, 'Name is too long.'),
    specialty: z.string(INVITE).trim().min(1, INVITE).max(100, 'Specialty is too long.'),
    email: emailSchema.pipe(z.email(INVITE).max(254, 'Email is too long.')),
  },
  { error: INVITE },
)

// POST /api/invitations/:token/accept — the doctor sets their own password.
export const acceptInvitationSchema = z.object({ password: newPasswordSchema }, { error: 'Please choose a password.' })

const DETAILS = 'Name and specialty are required.'

// PATCH /api/admin/doctors/:id with { name, specialty }
export const doctorDetailsSchema = z.object(
  {
    name: z.string(DETAILS).trim().min(1, DETAILS).max(100, 'Name is too long.'),
    specialty: z.string(DETAILS).trim().min(1, DETAILS).max(100, 'Specialty is too long.'),
  },
  { error: DETAILS },
)

// PATCH /api/admin/doctors/:id with { isActive }
export const doctorActiveSchema = z.object({ isActive: z.boolean('isActive must be true or false.') })
