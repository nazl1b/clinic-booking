// Addresses that can never receive mail (RFC 2606 / 6761), e.g. the demo accounts
// john@example.com or maria@clinic.test.
export function isReservedEmail(address: string): boolean {
  const domain = address.slice(address.lastIndexOf('@') + 1).toLowerCase()
  return /\.(test|example|invalid|localhost)$/.test(domain) || /(^|\.)example\.(com|net|org)$/.test(domain)
}

// On the public demo (PROTECT_DEMO_ACCOUNTS=true) the shared demo accounts keep
// their password: nobody can change it or reset it, so the next visitor can still
// log in. Locally and in the tests every account can change its password.
export function isProtectedDemoAccount(email: string): boolean {
  return process.env.PROTECT_DEMO_ACCOUNTS === 'true' && isReservedEmail(email)
}
