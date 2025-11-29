// src/app/api/lists/ensure-watched/route.ts
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('lists')
    .upsert(
      { owner_id: user.id, name: 'Animés vus', is_public: false, is_global: false },
      { onConflict: 'owner_id,name', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, listId: data.id })
}
