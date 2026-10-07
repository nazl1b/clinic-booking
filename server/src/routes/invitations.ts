import { Router } from 'express'
import { acceptInvitation, getInvitation } from '../controllers/invitations.js'

// Used by the invited doctor, who has no account yet: /api/invitations/:token
export const invitationsRouter = Router()

invitationsRouter.get('/:token', getInvitation)
invitationsRouter.post('/:token/accept', acceptInvitation)
