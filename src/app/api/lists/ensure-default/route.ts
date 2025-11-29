import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get('group_id')

  // === Cas groupe : on délègue à l’RPC SECURITY DEFINER ===
  if (groupId) {
    const { data, error } = await supabase.rpc('app_list_ensure_default', { gid: groupId })
    if (error) {
      // Si pas membre, l’RPC lève 'forbidden'
      return NextResponse.json({ error: error.message || 'server_error' }, { status: 500 })
    }
    return NextResponse.json({ listId: data })
  }

  // === Fallback historique (sans groupe) inchangé ===
  const { data: memberships, error: mErr } = await supabase
    .from('list_members')
    .select('list_id')
    .eq('user_id', user.id)
    .limit(1)

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
  if (memberships && memberships.length > 0) {
    return NextResponse.json({ listId: memberships[0].list_id })
  }

  const { data: list, error: lErr } = await supabase
    .from('lists')
    .insert({ name: 'Liste principale', owner_id: user.id, created_by: user.id })
    .select('id')
    .single()

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })

  const { error: jErr } = await supabase
    .from('list_members')
    .insert({ list_id: list.id, user_id: user.id, role: 'owner' })

  if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 })

  return NextResponse.json({ listId: list.id })
}
