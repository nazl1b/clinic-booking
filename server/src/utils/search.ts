// Prisma's `contains` becomes LIKE '%…%' without escaping, so "%" or "_" typed
// by the user would match everything. Backslash is LIKE's escape character in Postgres.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
