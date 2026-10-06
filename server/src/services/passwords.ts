import bcrypt from 'bcrypt'

const BCRYPT_ROUNDS = 12

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

// Compared against when there is no user, so a login with an unknown email
// takes as long as one with a wrong password and does not reveal which emails exist.
const dummyHash = hashPassword('not-a-real-password')

export async function verifyPassword(password: string, hash: string | undefined): Promise<boolean> {
  const matches = await bcrypt.compare(password, hash ?? (await dummyHash))
  return hash !== undefined && matches
}
