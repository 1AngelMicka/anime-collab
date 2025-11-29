// src/app/api/auth/set-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();

  const { access_token, refresh_token } = await req.json().catch(() => ({}));
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'tokens manquants' }, { status: 400 });
  }

  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // À partir d’ici, les cookies sb-*-auth-token.* sont écrits
  return NextResponse.json({ ok: true });
}
