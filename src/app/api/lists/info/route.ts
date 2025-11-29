import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  // Qui est connecté ?
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;

  // 1) Récupérer la liste (RLS doit autoriser l'accès)
  const { data: list, error } = await supabase
    .from('lists')
    .select('id, name, is_public, is_global, owner_id, group_id, created_at')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!list) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 2) Calculer is_owner / is_member (avec fallback si pas de groupe)
  const is_owner = !!(uid && list.owner_id && uid === list.owner_id);

  let is_member = false;
  if (uid) {
    if (list.group_id) {
      const { data: gm } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('group_id', list.group_id)
        .eq('user_id', uid)
        .maybeSingle();
      is_member = !!gm || is_owner;
    } else {
      const { data: lm } = await supabase
        .from('list_members')
        .select('list_id')
        .eq('list_id', list.id)
        .eq('user_id', uid)
        .maybeSingle();
      is_member = !!lm || is_owner;
    }
  }

  return NextResponse.json({
    list,
    is_owner,
    is_member,
  });
}
