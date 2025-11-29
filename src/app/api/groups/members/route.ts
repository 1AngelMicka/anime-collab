// src/app/api/groups/members/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

type Role = 'owner'|'admin'|'member'

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get('group_id')
  if (!groupId) return NextResponse.json({ error: 'group_id requis' }, { status: 400 })

  // ✅ Vérif appartenance via RPC (pas bloqué par RLS)
  const { data: myRole, error: roleErr } = await supabase.rpc('group_role', { gid: groupId, uid: user.id })
  if (roleErr) return NextResponse.json({ error: 'server_error' }, { status: 500 })
  if (!myRole) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // ✅ Liste des membres via RPC (pas bloqué par RLS)
  const { data: rows, error } = await supabase.rpc('get_group_members', { gid: groupId })
  if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  const members = (rows || []).map((r: any) => ({
    user_id: r.user_id,
    username: r.username,
    role: r.role as Role,
    joined_at: r.joined_at,
  }))

  return NextResponse.json({ members })
}

// POST /api/groups/members  body: { group_id, usernameOrEmail }
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const group_id = String(body?.group_id || '')
  const usernameOrEmail = String(body?.usernameOrEmail || '').trim()
  if (!group_id || !usernameOrEmail) return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  // Vérifier mon rôle dans le groupe via RPC
  const { data: myRole, error: roleErr } = await supabase.rpc('group_role', { gid: group_id, uid: user.id })
  if (roleErr) return NextResponse.json({ error: 'server_error' }, { status: 500 })
  if (!myRole) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Résoudre la cible par username (RPC SECURITY DEFINER)
  let targetId: string | null = null
  const { data: pid } = await supabase.rpc('profile_id_by_username', { u: usernameOrEmail })
  if (pid) targetId = pid as string
  // (Si tu veux aussi chercher par email, ajoute une RPC qui lookup auth.users côté serveur)

  if (!targetId) return NextResponse.json({ error: 'user_not_found' }, { status: 404 })

  // Déjà membre ?
  const { data: already } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', group_id)
    .eq('user_id', targetId)
    .maybeSingle()
  if (already) return NextResponse.json({ ok: true, already: true })

  // Insérer (RLS: owner ok; admin ok pour 'member'); on insère toujours 'member'
  const { error: insErr } = await supabase
    .from('group_members')
    .insert({ group_id, user_id: targetId, role: 'member' })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 403 })

  return NextResponse.json({ ok: true })
}

// DELETE /api/groups/members  body: { group_id, user_id }
export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const group_id = String(body?.group_id || '')
  const target_user_id = String(body?.user_id || '')
  if (!group_id || !target_user_id) return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  // Vérifier mon rôle via RPC
  const { data: myRole, error: roleErr } = await supabase.rpc('group_role', { gid: group_id, uid: user.id })
  if (roleErr) return NextResponse.json({ error: 'server_error' }, { status: 500 })
  if (!myRole) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Supprimer (RLS: owner tout; admin seulement membres)
  const { error: delErr } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', group_id)
    .eq('user_id', target_user_id)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 403 })
  return NextResponse.json({ ok: true })
}
