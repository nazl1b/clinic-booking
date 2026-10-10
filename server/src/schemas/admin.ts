import { z } from 'zod'
import { emailSchema, newPasswordSchema } from './auth.js'
import { bioSchema, optionalParam, pageParam, pageSizeParam, searchParam } from './common.js'

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

// PATCH /api/admin/doctors/:id with { name, specialty, bio? } — without bio, the bio stays as it is.
export const doctorDetailsSchema = z.object(
  {
    name: z.string(DETAILS).trim().min(1, DETAILS).max(100, 'Name is too long.'),
    specialty: z.string(DETAILS).trim().min(1, DETAILS).max(100, 'Specialty is too long.'),
    bio: bioSchema.optional(),
  },
  { error: DETAILS },
)

// GET /api/admin/doctors?search=&status=&page=&pageSize= (client/src/types: DoctorQuery)
export const doctorListSchema = z.object({
  search: searchParam, // name, specialty or email
  status: optionalParam(z.enum(['active', 'deactivated'], 'Invalid status.')),
  page: pageParam,
  pageSize: pageSizeParam,
})

export type DoctorListQuery = z.infer<typeof doctorListSchema>

// GET /api/admin/invitations?search=&page=&pageSize=
export const invitationListSchema = z.object({
  search: searchParam, // name, specialty or email
  page: pageParam,
  pageSize: pageSizeParam,
})

// PATCH /api/admin/doctors/:id with { isActive }
export const doctorActiveSchema = z.object({ isActive: z.boolean('isActive must be true or false.') })
