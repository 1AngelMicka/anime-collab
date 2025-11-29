// src/app/api/groups/invitations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/groups/invitations
// -> { invites: [{ id, group_id, group_name, status, inviter_username, created_at }] } (status='pending' seulement)
export async function GET() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ invites: [] }, { status: 200 })

  const { data, error } = await supabase
    .from('group_invitations')
    .select(`
      id, group_id, status, created_at,
      groups!inner(name, owner_id),
      inviter:profiles!group_invitations_invited_by_fkey(username)
    `)
    .eq('invited_user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ invites: [], error: error.message }, { status: 500 })

  const invites = (data || []).map((r: any) => ({
    id: r.id,
    group_id: r.group_id,
    status: r.status,
    created_at: r.created_at,
    group_name: r.groups?.name ?? 'Groupe',
    inviter_username: r.inviter?.username ?? '—',
  }))
  return NextResponse.json({ invites })
}

// PATCH /api/groups/invitations  body: { invite_id, action: 'accept'|'reject' }
export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const invite_id = String(body?.invite_id || '')
  const action = String(body?.action || '').toLowerCase()

  if (!invite_id || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 })
  }

  // Charger l’invitation (et sécuriser qu’elle t’est destinée)
  const { data: inv, error: invErr } = await supabase
    .from('group_invitations')
    .select('id, group_id, invited_user_id, invited_by, status')
    .eq('id', invite_id)
    .maybeSingle()

  if (invErr || !inv) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (inv.invited_user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (inv.status !== 'pending') return NextResponse.json({ error: 'already_processed' }, { status: 400 })

  if (action === 'reject') {
    const { error } = await supabase
      .from('group_invitations')
      .update({ status: 'rejected' })
      .eq('id', invite_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Optionnel: notifier l’invitant
    await supabase.from('notifications').insert({
      user_id: inv.invited_by,
      type: 'group_invite_refused',
      message: 'Invitation refusée',
      is_read: false
    })

    return NextResponse.json({ ok: true })
  }

  // accept
  // 1) marquer acceptée
  const { error: uErr } = await supabase
    .from('group_invitations')
    .update({ status: 'accepted' })
    .eq('id', invite_id)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  // 2) insérer dans group_members si pas déjà présent
  const { data: exists } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', inv.group_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!exists) {
    const { error: iErr } = await supabase
      .from('group_members')
      .insert({ group_id: inv.group_id, user_id: user.id, role: 'member' })
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
  }

  // Optionnel: notifier l’invitant
  await supabase.from('notifications').insert({
    user_id: inv.invited_by,
    type: 'group_invite_accepted',
    message: 'Invitation acceptée',
    is_read: false
  })

  return NextResponse.json({ ok: true })
}
