// src/app/admin/roles/page.tsx
'use client';

import { useEffect, useState } from 'react';

type RoleRow = {
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  perms: string[];
};

const ALL_PERMS = [
  'delete_proposals_any',
  'delete_profile',
  'manage_lists',
  'change_username',
  'manage_roles',
] as const;

export default function RolesAdminPage() {
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<string[]>([]);

  async function whoami() {
    try {
      const r = await fetch('/api/admin/whoami', { cache: 'no-store' });
      const j = await r.json().catch(()=>({ is_admin:false }));
      // On veut Owner strict ici; on re-vérifiera côté API de toute façon
      // Petite requête pour savoir si Owner : on peut checker via /api/admin/roles (qui renverra 403 si non-owner)
      return j;
    } catch {
      return { is_admin: false };
    }
  }

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/roles', { cache: 'no-store' });
      if (r.status === 403 || r.status === 401) {
        setIsOwner(false);
        setRoles([]);
        return;
      }
      const j = await r.json();
      setIsOwner(true);
      setRoles(j.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await whoami();
      await load();
    })();
  }, []);

  function toggleNewPerm(p: string) {
    setNewRolePerms(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev, p]);
  }

  async function createRole() {
    if (!newRoleName.trim()) return;
    const r = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        name: newRoleName.trim(),
        description: newRoleDesc.trim() || null,
        perms: newRolePerms,
      })
    });
    if (!r.ok) {
      const j = await r.json().catch(()=>({}));
      alert(j.error || 'Création impossible');
      return;
    }
    setNewRoleName('');
    setNewRoleDesc('');
    setNewRolePerms([]);
    await load();
  }

  async function saveRole(role: RoleRow) {
    const r = await fetch('/api/admin/roles', {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        name: role.name,
        description: role.description ?? null,
        perms: role.perms,
      })
    });
    if (!r.ok) {
      const j = await r.json().catch(()=>({}));
      alert(j.error || 'Mise à jour impossible');
      return;
    }
    await load();
  }

  async function deleteRole(role: RoleRow) {
    if (!confirm(`Supprimer le rôle "${role.name}" ?`)) return;
    const r = await fetch('/api/admin/roles', {
      method: 'DELETE',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ name: role.name })
    });
    if (!r.ok) {
      const j = await r.json().catch(()=>({}));
      if (j.error === 'role_in_use') alert('Ce rôle est encore utilisé par des membres.');
      else if (j.error === 'system_role_locked') alert('Rôle système protégé.');
      else alert(j.error || 'Suppression impossible');
      return;
    }
    await load();
  }

  if (loading) return <div className="card p-4">Chargement…</div>;
  if (!isOwner) return <div className="card p-4">Accès réservé au propriétaire du site.</div>;

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <h1 className="text-xl font-semibold mb-2">Administration – Rôles & Permissions</h1>
        <p className="text-sm opacity-70">
          Gère les rôles et leurs permissions. Le rôle <strong>owner</strong> est unique et protégé.
        </p>
      </div>

      {/* Créer un rôle */}
      <div className="card p-4 space-y-3">
        <div className="font-medium">Créer un rôle</div>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Nom du rôle (ex: editor)"
            value={newRoleName}
            onChange={(e)=>setNewRoleName(e.target.value)}
          />
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Description (optionnel)"
            value={newRoleDesc}
            onChange={(e)=>setNewRoleDesc(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_PERMS.map(p => (
            <label key={p} className="text-sm flex items-center gap-1 border rounded-xl px-2 py-1">
              <input
                type="checkbox"
                checked={newRolePerms.includes(p)}
                onChange={()=>toggleNewPerm(p)}
              />
              {p}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" onClick={createRole}>Créer</button>
      </div>

      {/* Liste des rôles */}
      <div className="card p-4">
        <div className="font-medium mb-2">Rôles existants</div>
        {roles.length === 0 ? (
          <div className="text-sm opacity-70">Aucun rôle.</div>
        ) : (
          <ul className="space-y-3">
            {roles.map(role => {
              const isOwnerRole = role.name === 'owner'
              return (
                <li key={role.name} className="p-3 border rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{role.name}</div>
                    <div className="text-xs opacity-60">{role.is_system ? 'Système' : 'Custom'}</div>
                  </div>

                  <div className="mt-2">
                    <input
                      className="border rounded-xl px-3 py-2 w-full"
                      placeholder="Description"
                      value={role.description || ''}
                      disabled={isOwnerRole}
                      onChange={(e)=> {
                        role.description = e.target.value
                        // MAJ locale seulement
                        setRoles([...roles])
                      }}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {ALL_PERMS.map(p => {
                      const checked = role.perms.includes(p)
                      return (
                        <label key={p} className={`text-sm flex items-center gap-1 border rounded-xl px-2 py-1 ${isOwnerRole ? 'opacity-60' : ''}`}>
                          <input
                            type="checkbox"
                            disabled={isOwnerRole}
                            checked={checked}
                            onChange={()=> {
                              if (checked) role.perms = role.perms.filter(x=>x!==p)
                              else role.perms = [...role.perms, p]
                              setRoles([...roles])
                            }}
                          />
                          {p}
                        </label>
                      )
                    })}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      className="btn btn-primary"
                      disabled={isOwnerRole}
                      onClick={()=> saveRole(role)}
                    >Sauvegarder</button>
                    {!role.is_system && !isOwnerRole && (
                      <button className="btn btn-danger" onClick={()=> deleteRole(role)}>Supprimer</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
