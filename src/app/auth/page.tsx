// src/app/auth/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function AuthPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function setServerSession(access_token: string, refresh_token: string) {
    // Écrit les cookies sb-* côté serveur pour que /api/auth/me te voie connecté
    const r = await fetch('/api/auth/set-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token, refresh_token }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || 'Impossible d’établir la session serveur');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pwd,
        });
        if (error) throw error;

        const at = data.session?.access_token;
        const rt = data.session?.refresh_token;
        if (at && rt) {
          await setServerSession(at, rt);
        }
        // Redirige et rafraîchit pour que HeaderBar reflète l’état
        router.replace('/');
        router.refresh();
        return;
      }

      // SIGNUP
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pwd,
      });
      if (error) throw error;

      // Si l’instance Supabase n’exige PAS la vérification d’email,
      // data.session sera défini → on peut poser la session serveur
      const at = data.session?.access_token;
      const rt = data.session?.refresh_token;
      if (at && rt) {
        await setServerSession(at, rt);
        router.replace('/');
        router.refresh();
        return;
      }

      // Sinon, vérification email requise
      setMsg("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis reconnecte-toi.");
    } catch (e: any) {
      setErr(e?.message || 'Erreur inconnue');
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const emailInput = e.currentTarget.elements.namedItem('resetEmail') as HTMLInputElement | null;
    const emailReset = emailInput?.value.trim();
    if (!emailReset) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailReset, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth`,
      });
      if (error) throw error;
      setMsg('Email de réinitialisation envoyé ✅');
      if (emailInput) emailInput.value = '';
    } catch (e: any) {
      setErr(e?.message || 'Erreur lors de l’envoi');
    }
  }

  return (
    <div className="max-w-sm mx-auto card p-6">
      <h1 className="text-lg font-semibold mb-3">
        {mode === 'signin' ? 'Connexion' : 'Créer un compte'}
      </h1>

      {err && <div className="mb-3 text-sm text-red-600">{err}</div>}
      {msg && <div className="mb-3 text-sm text-green-600">{msg}</div>}

      <form onSubmit={submit} className="space-y-3">
        <input
          className="border rounded-xl px-3 py-2 w-full"
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="border rounded-xl px-3 py-2 w-full"
          type="password"
          placeholder="Mot de passe"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          required
        />
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? '…' : mode === 'signin' ? 'Se connecter' : 'Créer le compte'}
        </button>
      </form>

      <div className="text-sm mt-3">
        {mode === 'signin' ? (
          <>
            Pas de compte ?{' '}
            <button className="underline" onClick={() => setMode('signup')}>
              Créer un compte
            </button>
          </>
        ) : (
          <>
            Déjà inscrit ?{' '}
            <button className="underline" onClick={() => setMode('signin')}>
              Se connecter
            </button>
          </>
        )}
      </div>

      <form className="mt-4 space-y-2" onSubmit={onReset}>
        <label className="text-xs opacity-70">Mot de passe oublié</label>
        <div className="flex gap-2">
          <input
            name="resetEmail"
            className="border rounded-xl px-3 py-2 flex-1"
            placeholder="Ton email"
            type="email"
          />
          <button className="btn" type="submit">Envoyer</button>
        </div>
      </form>
    </div>
  );
}
