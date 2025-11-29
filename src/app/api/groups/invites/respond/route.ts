// src/app/api/groups/invites/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * Table attendue:
 *   group_invites(id uuid pk, group_id uuid, invited_user_id uuid, inviter_id uuid,
 *                 status text default 'pending', created_at timestamptz default now())
 *   statuses: 'pending' | 'accepted' | 'refused'
 *
 * RLS minimum:
 *   - SELECT: invited_user_id = auth.uid() OR inviter_id = auth.uid()
 *   - UPDATE/DELETE: invited_user_id = auth.uid() (pour accepter/refuser)
 */

export async function GET() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ invites: [] }, { status: 200 })

  const { data, error } = await supabase
    .from('group_invites')
    .select('id, group_id, invited_user_id, inviter_id, status, created_at, groups(name), inviter:profiles!inviter_id(username)')
    .eq('invited_user_id', user.id)
    .in('status', ['pending', 'accepted', 'refused']) // on peut filtrer côté UI
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const invites = (data || []).map((x: any) => ({
    id: x.id,
    group_id: x.group_id,
    status: x.status as 'pending'|'accepted'|'refused',
    created_at: x.created_at,
    group_name: x.groups?.name ?? 'Groupe',
    inviter_username: x.inviter?.username ?? null,
  }))

  return NextResponse.json({ invites })
}

// POST /api/groups/invites { invite_id }  => accepter
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(()=> ({}))
  const invite_id = String(body?.invite_id || '')
  if (!invite_id) return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  // Lire l'invite (RLS: invited_user_id = auth.uid())
  const { data: inv, error: e1 } = await supabase
    .from('group_invites')
    .select('id, group_id, invited_user_id, status')
    .eq('id', invite_id)
    .maybeSingle()

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (!inv) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (inv.invited_user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (inv.status !== 'pending') return NextResponse.json({ ok: true }) // déjà traité

  // Ajouter comme membre si pas déjà
  const { data: exists } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', inv.group_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!exists) {
    const { error: insErr } = await supabase
      .from('group_members')
      .insert({ group_id: inv.group_id, user_id: user.id, role: 'member' })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // Marquer l’invite acceptée
  const { error: updErr } = await supabase
    .from('group_invites')
    .update({ status: 'accepted' })
    .eq('id', invite_id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Optionnel: créer une notif au créateur du groupe
  // (si tu veux notifier le "owner/admin" original)

  return NextResponse.json({ ok: true })
}

// DELETE /api/groups/invites { invite_id } => refuser
export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(()=> ({}))
  const invite_id = String(body?.invite_id || '')
  if (!invite_id) return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  const { data: inv, error: e1 } = await supabase
    .from('group_invites')
    .select('id, invited_user_id, status')
    .eq('id', invite_id)
    .maybeSingle()

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (!inv) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (inv.invited_user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (inv.status !== 'pending') return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('group_invites')
    .update({ status: 'refused' })
    .eq('id', invite_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
