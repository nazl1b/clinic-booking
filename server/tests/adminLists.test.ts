// The admin's doctor and invitation lists: server-side search, filters and pages.
import { beforeAll, describe, expect, it } from 'vitest'
import { createUser, loginAs, prisma } from './helpers.js'

type Agent = Awaited<ReturnType<typeof loginAs>>
let admin: Agent

beforeAll(async () => {
  const adminUser = await createUser({ role: 'admin' })
  admin = await loginAs(adminUser.email)

  // 25 doctors: "Doctor 01"…"Doctor 25", every 5th deactivated, two specialties.
  for (let i = 1; i <= 25; i++) {
    const n = String(i).padStart(2, '0')
    await createUser({ role: 'doctor', name: `Doctor ${n}`, email: `doc${n}@example.test`, specialty: i % 2 ? 'Cardiology' : 'Dermatology', isActive: i % 5 !== 0 })
  }
  await createUser({ role: 'doctor', name: 'Dr. 100% Sure', email: 'sure@example.test' })

  // 12 pending invitations, plus one already used (never listed).
  for (let i = 1; i <= 12; i++) {
    await prisma.invitation.create({
      data: { name: `Invited ${i}`, specialty: i === 7 ? 'Neurology' : 'Pediatrics', email: `invited${i}@example.test`, tokenHash: `hash-${i}`, expiresAt: new Date(Date.now() + 3_600_000), invitedBy: adminUser.id },
    })
  }
  await prisma.invitation.create({
    data: { name: 'Used One', specialty: 'Pediatrics', email: 'used@example.test', tokenHash: 'hash-used', expiresAt: new Date(Date.now() + 3_600_000), usedAt: new Date(), invitedBy: adminUser.id },
  })
})

const doctors = async (query: string) => (await admin.get(`/api/admin/doctors${query}`)).body as { items: { name: string; isActive: boolean }[]; page: number; pageSize: number; total: number }
const invitations = async (query: string) => (await admin.get(`/api/admin/invitations${query}`)).body as { items: { name: string }[]; total: number }

describe('admin doctor list', () => {
  it('returns pages of 20 with the total, active doctors first', async () => {
    const first = await doctors('')
    expect(first).toMatchObject({ page: 1, pageSize: 20, total: 26 })
    expect(first.items).toHaveLength(20)
    expect(first.items.every((d) => d.isActive)).toBe(true)

    const second = await doctors('?page=2')
    expect(second.items).toHaveLength(6)
    expect(second.items.map((d) => d.isActive)).toEqual([true, false, false, false, false, false]) // the 21st active one, then the 5 deactivated
    expect(new Set([...first.items, ...second.items].map((d) => d.name)).size).toBe(26)
  })

  it('filters by status', async () => {
    expect((await doctors('?status=active')).total).toBe(21)
    expect((await doctors('?status=deactivated')).total).toBe(5)
    expect((await admin.get('/api/admin/doctors?status=retired')).status).toBe(400)
  })

  it('searches name, specialty and email, ignoring case', async () => {
    expect((await doctors('?search=doctor 1')).items.map((d) => d.name)).toEqual(['Doctor 11', 'Doctor 12', 'Doctor 13', 'Doctor 14', 'Doctor 16', 'Doctor 17', 'Doctor 18', 'Doctor 19', 'Doctor 10', 'Doctor 15'])
    expect((await doctors('?search=DERMATOLOGY')).total).toBe(12)
    expect((await doctors('?search=doc25@')).items.map((d) => d.name)).toEqual(['Doctor 25'])
    expect((await doctors('?search=dermatology&status=deactivated')).total).toBe(2) // 10 and 20
  })

  it('treats % and _ as plain text', async () => {
    expect((await doctors('?search=%25')).items.map((d) => d.name)).toEqual(['Dr. 100% Sure'])
    expect((await doctors('?search=_')).total).toBe(0)
  })
})

describe('admin invitation list', () => {
  it('returns pages of pending invitations with the total', async () => {
    const first = await invitations('?pageSize=10')
    expect(first.total).toBe(12)
    expect(first.items.map((i) => i.name)).toEqual(Array.from({ length: 10 }, (_, i) => `Invited ${i + 1}`))
    expect((await invitations('?pageSize=10&page=2')).items.map((i) => i.name)).toEqual(['Invited 11', 'Invited 12'])
  })

  it('searches name, specialty and email; used invitations never show', async () => {
    expect((await invitations('?search=neuro')).items.map((i) => i.name)).toEqual(['Invited 7'])
    expect((await invitations('?search=invited12@')).items.map((i) => i.name)).toEqual(['Invited 12'])
    expect((await invitations('?search=used')).total).toBe(0)
  })

  it('is for admins only', async () => {
    const doctor = await loginAs('doc01@example.test')
    expect((await doctor.get('/api/admin/invitations')).status).toBe(403)
    expect((await doctor.get('/api/admin/doctors')).status).toBe(403)
  })
})
