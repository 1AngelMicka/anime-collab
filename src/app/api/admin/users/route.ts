// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

type Role = 'owner'|'admin'|'moderator'|'member'|'user'|'guest'|string

// Hiérarchie
function normalizeRole(r?: string | null): Role {
  if (!r) return 'user'
  const lower = r.toLowerCase()
  if (lower === 'invité' || lower === 'invite') return 'guest'
  if (lower === 'membre') return 'member'
  return (['owner','admin','moderator','member','user','guest'].includes(lower) ? lower : 'user') as Role
}
function roleRank(r?: string | null): number {
  switch (normalizeRole(r)) {
    case 'owner': return 100
    case 'admin': return 80
    case 'moderator': return 50
    case 'member': return 20
    case 'user': return 10
    case 'guest': return 0
    default: return 10
  }
}

// ✅ UTILISE RPC whoami_flags() pour déterminer mes droits (pas bloqué par RLS)
async function getMe() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, reason: 'unauthorized' as const }

  const { data, error } = await supabase.rpc('whoami_flags')
  if (error || !Array.isArray(data) || data.length === 0) {
    return { ok: false as const, reason: 'forbidden' as const }
  }
  const row = data[0] as any
  const myRole = normalizeRole(row?.role)
  const isOwner = myRole === 'owner'
  const isAdmin = isOwner || !!row?.is_admin

  return isAdmin
    ? { ok: true as const, supabase, user, me: { id: user.id, role: myRole, rank: roleRank(myRole), isOwner, isAdmin } }
    : { ok: false as const, reason: 'forbidden' as const }
}

async function countOwners(supabase: Awaited<ReturnType<typeof supabaseServer>>) {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'owner')
  if (error) throw new Error(error.message)
  return count ?? 0
}


// GET /api/admin/users?search=&limit=50&offset=0
export async function GET(req: NextRequest) {
  const a = await getMe()
  if (!a.ok) {
    const code = a.reason === 'unauthorized' ? 401 : 403
    return NextResponse.json({ error: a.reason }, { status: code })
  }
  const supabase = a.supabase

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 50)))
  const offset = Math.max(0, Number(searchParams.get('offset') || 0))

  // ➜ Utilise la RPC SECURITY DEFINER (bypass RLS proprement)
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_search: search,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    // Fallback (facultatif) si la RPC n’existe pas
    let q = supabase
      .from('profiles')
      .select('id, username, role, is_admin, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) q = q.ilike('username', `%${search}%`)

    const { data: d2, error: e2, count } = await q
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json({ items: d2 || [], total: count ?? 0 })
  }

  // La RPC renvoie total_count dans chaque ligne ; on l’extrait
  const items = (data || []).map((r: any) => ({
    id: r.id, username: r.username, role: r.role, is_admin: r.is_admin, created_at: r.created_at
  }))
  const total = (data && data[0] && data[0].total_count) ? data[0].total_count : (items?.length || 0)
  return NextResponse.json({ items, total })
}


// PATCH /api/admin/users
export async function PATCH(req: NextRequest) {
  const a = await getMe()
  if (!a.ok) {
    const code = a.reason === 'unauthorized' ? 401 : 403
    return NextResponse.json({ error: a.reason }, { status: code })
  }
  const supabase = a.supabase
  const me = a.me

  const body = await req.json().catch(() => ({}))
  const { id, username, role, is_admin } = body as {
    id?: string
    username?: string
    role?: Role
    is_admin?: boolean
  }
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { data: target, error: eT } = await supabase
    .from('profiles')
    .select('id, role, is_admin, username')
    .eq('id', id)
    .maybeSingle()
  if (eT) return NextResponse.json({ error: eT.message }, { status: 500 })
  if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const targetRole = normalizeRole(target.role)
  const targetRank = roleRank(targetRole)

  const changingRole = typeof role === 'string'
  const newRole = changingRole ? normalizeRole(role!) : targetRole
  const newRank = roleRank(newRole)
  const changingAdmin = typeof is_admin === 'boolean'
  const changingUsername = typeof username === 'string'

  if (targetRole === 'owner' && id !== me.id) {
    return NextResponse.json({ error: 'forbidden_owner_only' }, { status: 403 })
  }

  if (id !== me.id && targetRank >= me.rank) {
    return NextResponse.json({ error: 'forbidden_higher_or_equal' }, { status: 403 })
  }

  if (changingRole && newRank >= me.rank && !(me.isOwner && id === me.id && newRole === 'owner')) {
    return NextResponse.json({ error: 'forbidden_cannot_grant_equal_or_higher' }, { status: 403 })
  }

  if (changingRole && newRole === 'owner' && id !== me.id) {
    return NextResponse.json({ error: 'owner_unique' }, { status: 403 })
  }

  if (targetRole === 'owner' && id === me.id) {
    const owners = await countOwners(supabase)
    const demoteOwner =
      (changingRole && newRole !== 'owner') ||
      (changingAdmin && is_admin === false)
    if (demoteOwner && owners <= 1) {
      return NextResponse.json({ error: 'last_owner_protected' }, { status: 409 })
    }
  }

  const patch: Record<string, any> = {}

  if (changingRole) {
    patch.role = newRole
    if (newRole === 'owner' || newRole === 'admin') patch.is_admin = true
    else patch.is_admin = false
  }

  if (changingAdmin) {
    if (targetRole === 'owner' && is_admin === false) {
      return NextResponse.json({ error: 'owner_always_admin' }, { status: 403 })
    }
    if (!changingRole) {
      if (is_admin === true) {
        if (me.rank <= roleRank('admin')) {
          return NextResponse.json({ error: 'forbidden_cannot_grant_equal_or_higher' }, { status: 403 })
        }
        patch.role = 'admin'
        patch.is_admin = true
      } else {
        patch.role = 'user'
        patch.is_admin = false
      }
    }
  }

  if (changingUsername) {
    const u = username!.trim()
    if (!u) return NextResponse.json({ error: 'username_invalid' }, { status: 400 })
    if (u.length < 3 || u.length > 32) return NextResponse.json({ error: 'username_length' }, { status: 400 })
    patch.username = u
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'aucune_modification' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', id)

  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'username_taken' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/users  body: { id }
export async function DELETE(req: NextRequest) {
  const a = await getMe()
  if (!a.ok) {
    const code = a.reason === 'unauthorized' ? 401 : 403
    return NextResponse.json({ error: a.reason }, { status: code })
  }
  const supabase = a.supabase
  const me = a.me

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { data: target, error: eT } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', id)
    .maybeSingle()
  if (eT) return NextResponse.json({ error: eT.message }, { status: 500 })
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const targetRole = normalizeRole(target.role)
  const targetRank = roleRank(targetRole)

  if (id !== me.id && targetRank >= me.rank) {
    return NextResponse.json({ error: 'forbidden_higher_or_equal' }, { status: 403 })
  }

  if (targetRole === 'owner') {
    if (!me.isOwner) return NextResponse.json({ error: 'forbidden_owner_only' }, { status: 403 })
    const owners = await countOwners(supabase)
    if (owners <= 1) return NextResponse.json({ error: 'last_owner_protected' }, { status: 409 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && serviceKey) {
    try {
      const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      const { error: delErr } = await admin.auth.admin.deleteUser(id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'deleteUser_failed' }, { status: 500 })
    }
  } else {
    return NextResponse.json({
      error: 'service_role_absent',
      hint: 'Définis SUPABASE_SERVICE_ROLE_KEY pour activer la suppression de compte.',
    }, { status: 501 })
  }

  return NextResponse.json({ ok: true })
}
