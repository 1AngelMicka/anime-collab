// src/app/api/admin/roles/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

type RolePayload = {
  name?: string
  description?: string | null
  perms?: string[] // ex: ['delete_proposals_any','delete_profile',...]
}

const ALL_PERMS = [
  'delete_proposals_any',
  'delete_profile',
  'manage_lists',
  'change_username',
  'manage_roles',
] as const
type PermKey = typeof ALL_PERMS[number]

// ✅ Utilise le RPC whoami_flags() (SECURITY DEFINER) → pas bloqué par RLS
async function assertOwner() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, reason: 'unauthorized' as const }

  const { data, error } = await supabase.rpc('whoami_flags')
  if (error || !Array.isArray(data) || data.length === 0) {
    return { ok: false as const, reason: 'forbidden' as const }
  }
  const row = data[0] as any
  // Allow Owner OR accounts explicitly flagged as is_admin to manage roles.
  // Change this if you want Owner-only behavior (safer).
  const isOwnerOrAdmin = row?.role === 'owner' || !!row?.is_admin
  return isOwnerOrAdmin ? { ok: true as const, supabase } : { ok: false as const, reason: 'forbidden' as const }
}

// GET /api/admin/roles
export async function GET() {
  const a = await assertOwner()
  if (!a.ok) {
    const code = a.reason === 'unauthorized' ? 401 : 403
    return NextResponse.json({ error: a.reason }, { status: code })
  }
  const supabase = a.supabase

  const { data: roles, error: e1 } = await supabase
    .from('roles')
    .select('name, description, is_system, created_at')
    .order('is_system', { ascending: false })
    .order('name')
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const { data: perms, error: e2 } = await supabase
    .from('role_permissions')
    .select('role_name, perm')
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  const map: Record<string, string[]> = {}
  for (const p of perms || []) {
    (map[p.role_name] ||= []).push(p.perm)
  }

  const items = (roles || []).map(r => ({
    ...r,
    perms: map[r.name] || []
  }))

  return NextResponse.json({ items, allPerms: ALL_PERMS })
}

// POST /api/admin/roles  body: { name, description?, perms? }
export async function POST(req: NextRequest) {
  const a = await assertOwner()
  if (!a.ok) {
    const code = a.reason === 'unauthorized' ? 401 : 403
    return NextResponse.json({ error: a.reason }, { status: code })
  }
  const supabase = a.supabase

  const body = await req.json().catch(()=> ({}))
  const { name, description, perms = [] } = body as RolePayload
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name requis' }, { status: 400 })
  }
  const roleName = name.trim()

  const invalid = (perms as string[]).filter(p => !ALL_PERMS.includes(p as PermKey))
  if (invalid.length > 0) return NextResponse.json({ error: 'invalid_perms', detail: invalid }, { status: 400 })

  const { error: e1 } = await supabase
    .from('roles')
    .insert({ name: roleName, description: description ?? null, is_system: false })
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  if (perms.length > 0) {
    const rows = (perms as string[]).map(p => ({ role_name: roleName, perm: p }))
    const { error: e2 } = await supabase.from('role_permissions').insert(rows)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// PATCH /api/admin/roles  body: { name, description?, perms? }
export async function PATCH(req: NextRequest) {
  const a = await assertOwner()
  if (!a.ok) {
    const code = a.reason === 'unauthorized' ? 401 : 403
    return NextResponse.json({ error: a.reason }, { status: code })
  }
  const supabase = a.supabase

  const body = await req.json().catch(()=> ({}))
  const { name, description, perms } = body as RolePayload
  if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 })

  if (name === 'owner') {
    return NextResponse.json({ error: 'owner_locked' }, { status: 403 })
  }

  if (typeof description !== 'undefined') {
    const { error: e1 } = await supabase
      .from('roles')
      .update({ description })
      .eq('name', name)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  }

  if (Array.isArray(perms)) {
    const invalid = perms.filter(p => !ALL_PERMS.includes(p as PermKey))
    if (invalid.length > 0) return NextResponse.json({ error: 'invalid_perms', detail: invalid }, { status: 400 })

    const { error: eDel } = await supabase.from('role_permissions').delete().eq('role_name', name)
    if (eDel) return NextResponse.json({ error: eDel.message }, { status: 500 })

    if (perms.length > 0) {
      const rows = perms.map(p => ({ role_name: name, perm: p }))
      const { error: eIns } = await supabase.from('role_permissions').insert(rows)
      if (eIns) return NextResponse.json({ error: eIns.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/roles  body: { name }
export async function DELETE(req: NextRequest) {
  const a = await assertOwner()
  if (!a.ok) {
    const code = a.reason === 'unauthorized' ? 401 : 403
    return NextResponse.json({ error: a.reason }, { status: code })
  }
  const supabase = a.supabase

  const { name } = await req.json().catch(()=> ({}))
  if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 })

  const { data: role } = await supabase
    .from('roles')
    .select('is_system')
    .eq('name', name)
    .maybeSingle()
  if (!role) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (role.is_system || name === 'owner') {
    return NextResponse.json({ error: 'system_role_locked' }, { status: 403 })
  }

  const { count, error: eCnt } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', name)
  if (eCnt) return NextResponse.json({ error: eCnt.message }, { status: 500 })
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'role_in_use' }, { status: 409 })
  }

  const { error: eDel } = await supabase.from('roles').delete().eq('name', name)
  if (eDel) return NextResponse.json({ error: eDel.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
