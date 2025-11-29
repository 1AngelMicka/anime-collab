// src/app/api/admin/whoami/route.ts
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * GET /api/admin/whoami
 * Retourne { is_admin: boolean } en s'appuyant sur whoami_flags() (SECURITY DEFINER)
 * -> évite les soucis RLS côté client.
 */
export async function GET() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ is_admin: false }, { status: 200 })
  }

  // whoami_flags() renvoie (is_admin, role) de façon sûre
  const { data, error } = await supabase.rpc('whoami_flags')
  if (error) {
    // Par fallback minimal : on tente directement profiles (si RLS OK)
    const fallback = await supabase
      .from('profiles')
      .select('is_admin, role')
      .eq('id', user.id)
      .maybeSingle()

    if (fallback.error) {
      return NextResponse.json({ is_admin: false }, { status: 200 })
    }
    const isAdmin = !!(fallback.data?.is_admin) || fallback.data?.role === 'owner'
    return NextResponse.json({ is_admin: isAdmin }, { status: 200 })
  }

  const isAdmin = !!(data?.[0]?.is_admin) || data?.[0]?.role === 'owner'
  return NextResponse.json({ is_admin: isAdmin }, { status: 200 })
}
