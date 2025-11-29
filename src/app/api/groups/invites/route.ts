// src/app/api/groups/invites/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/groups/invites
// - Liste les invitations qui me concernent (reçues = incoming, envoyées = outgoing)
// - Ajoute ?debug=1 pour renvoyer les messages d’erreur supabase en clair
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { searchParams } = new URL(req.url)
  const debug = searchParams.get('debug') === '1'

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    // Invitations reçues (où JE suis l’invité)
    const { data: incoming, error: e1 } = await supabase
      .from('group_invites')
      .select('id, group_id, inviter_id, invited_user_id, status, created_at')
      .eq('invited_user_id', user.id)
      .order('created_at', { ascending: false })
    if (e1) throw e1

    // Invitations envoyées (où JE suis l’invitant)
    const { data: outgoing, error: e2 } = await supabase
      .from('group_invites')
      .select('id, group_id, inviter_id, invited_user_id, status, created_at')
      .eq('inviter_id', user.id)
      .order('created_at', { ascending: false })
    if (e2) throw e2

    return NextResponse.json({ incoming: incoming || [], outgoing: outgoing || [] })
  } catch (err: any) {
    if (debug) {
      return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
    }
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// PATCH /api/groups/invites
// body: { id: string, action: 'accept' | 'decline' }
// - accept : si pending et que JE suis invited_user_id, on m’ajoute à group_members puis on passe l’invite à 'accepted'
// - decline : si pending et que JE suis invited_user_id, on passe l’invite à 'declined'
export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = String(body?.id || '')
  const action = String(body?.action || '')

  if (!id || (action !== 'accept' && action !== 'decline')) {
    return NextResponse.json({ error: 'bad_payload' }, { status: 400 })
  }

  try {
    // Charger l’invite, vérifier que JE suis bien le destinataire et qu’elle est pending
    const { data: invite, error: e1 } = await supabase
      .from('group_invites')
      .select('id, group_id, inviter_id, invited_user_id, status')
      .eq('id', id)
      .maybeSingle()
    if (e1) throw e1
    if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (invite.invited_user_id !== user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'not_pending' }, { status: 409 })
    }

    if (action === 'accept') {
      // Ajouter membre (idempotent côté RLS/unique si tu as une contrainte)
      const { error: eIns } = await supabase
        .from('group_members')
        .insert({ group_id: invite.group_id, user_id: user.id, role: 'member' })
      if (eIns && (eIns as any).code !== '23505') throw eIns // 23505 = déjà membre, on ignore

      // Marquer accepted
      const { error: eUp } = await supabase
        .from('group_invites')
        .update({ status: 'accepted' })
        .eq('id', id)
      if (eUp) throw eUp

      // (Optionnel) Créer une notification pour l’invitant
      // await supabase.from('notifications').insert({ user_id: invite.inviter_id, type: 'invite_accepted', message: '...' })

      return NextResponse.json({ ok: true, accepted: true })
    } else {
      // decline
      const { error: eUp } = await supabase
        .from('group_invites')
        .update({ status: 'declined' })
        .eq('id', id)
      if (eUp) throw eUp

      // (Optionnel) notif l’invitant
      // await supabase.from('notifications').insert({ user_id: invite.inviter_id, type: 'invite_declined', message: '...' })

      return NextResponse.json({ ok: true, declined: true })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
