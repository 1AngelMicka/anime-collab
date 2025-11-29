// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await supabaseServer()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) return NextResponse.json({ user: null }, { status: 200 })
  if (!user) return NextResponse.json({ user: null }, { status: 200 })

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
    }
  })
}
