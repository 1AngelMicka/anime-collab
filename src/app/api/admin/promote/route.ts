import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// POST { usernameOrId } -> set profiles.is_admin=true
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { usernameOrId } = await req.json().catch(()=> ({}))
  if (!usernameOrId) return NextResponse.json({ error: 'usernameOrId requis' }, { status: 400 })

  // si c'est un UUID, on l'utilise tel quel, sinon on cherche par username
  let targetId = usernameOrId
  if (!/^[0-9a-fA-F-]{36}$/.test(usernameOrId)) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', usernameOrId)
      .maybeSingle()
    if (!prof?.id) return NextResponse.json({ error: 'profil introuvable' }, { status: 404 })
    targetId = prof.id
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', targetId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
