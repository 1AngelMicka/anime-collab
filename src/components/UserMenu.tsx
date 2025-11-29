'use client';
import { supabaseBrowser } from '../lib/supabase-browser';

export default function UserMenu({ email }: { email?: string | null }) {
  const supabase = supabaseBrowser();

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(error.message);
      return;
    }
    // Force un refresh de la page pour re-rendre le header côté serveur
    window.location.reload();
  }

  if (!email) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="opacity-80">{email}</span>
      <button className="btn" onClick={handleLogout}>Se déconnecter</button>
    </div>
  );
}
