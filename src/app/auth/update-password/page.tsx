'use client'
import { useState } from 'react'
import { supabaseBrowser } from '../../../lib/supabase-browser'

export default function UpdatePasswordPage() {
  const supabase = supabaseBrowser()
  const [password, setPassword] = useState('')
  const [ok, setOk] = useState(false)

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) alert(error.message)
    else {
      setOk(true)
      setTimeout(()=> { window.location.href = '/' }, 800)
    }
  }

  return (
    <form onSubmit={handleUpdate} className="card p-6 max-w-md mx-auto mt-10">
      <h1 className="text-lg font-semibold mb-3">Nouveau mot de passe</h1>
      <input
        type="password"
        className="border rounded-xl px-3 py-2 w-full"
        placeholder="Saisis ton nouveau mot de passe"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button className="btn btn-primary mt-3" type="submit">Mettre à jour</button>
      {ok && <p className="text-sm mt-2">Mot de passe mis à jour ✅</p>}
    </form>
  )
}
