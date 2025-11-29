import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { searchParams } = new URL(req.url);
  const u = (searchParams.get('u') || '').trim();
  if (u.length < 3) return NextResponse.json({ available: false });

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', u)
    .limit(1);

  if (error) return NextResponse.json({ available: false });
  return NextResponse.json({ available: (data?.length ?? 0) === 0 });
}
