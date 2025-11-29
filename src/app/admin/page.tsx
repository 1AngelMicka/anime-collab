'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Proposal = {
  id: string;
  list_id: string;
  user_id: string;
  anime_title: string;
  status: 'pending'|'approved'|'rejected';
  created_at: string;
};

type Member = {
  id: string;
  username: string | null;
  role: 'owner'|'admin'|'moderator'|'user' | null;
  is_admin: boolean | null;
  created_at: string;
};

function RoleBadge({ role }: { role: Member['role'] }) {
  const map: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700',
    admin: 'bg-red-100 text-red-700',
    moderator: 'bg-blue-100 text-blue-700',
    user: 'bg-gray-100 text-gray-700',
  };
  const cls = map[role || 'user'] || map.user;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>
      {role || 'user'}
    </span>
  );
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canManageRoles, setCanManageRoles] = useState(false); // ✅ accès /admin/roles (Owner)

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [newGlobalName, setNewGlobalName] = useState('');

  // Members
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  async function whoami() {
    try {
      const r = await fetch('/api/admin/whoami', { cache: 'no-store' });
      const j = await r.json().catch(()=>({is_admin:false}));
      setIsAdmin(!!j.is_admin);
    } catch {
      setIsAdmin(false);
    }
  }

  // ping l’endpoint /admin/roles (200 => Owner ; 401/403 => pas Owner)
  async function checkRolesAccess() {
    try {
      const r = await fetch('/api/admin/roles', { cache: 'no-store' });
      setCanManageRoles(r.ok); // 200 => true ; 401/403 => false
    } catch {
      setCanManageRoles(false);
    }
  }

  async function loadProposals() {
    const r = await fetch('/api/admin/proposals', { cache: 'no-store' });
    const j = await r.json().catch(()=>({items:[]}));
    setProposals(j.items || []);
  }

  async function loadMembers(params?: { search?: string; limit?: number; offset?: number }) {
    const s = params?.search ?? search;
    const l = params?.limit ?? limit;
    const o = params?.offset ?? offset;
    const qs = new URLSearchParams({ search: s, limit: String(l), offset: String(o) }).toString();
    const r = await fetch(`/api/admin/users?${qs}`, { cache: 'no-store' });
    const j = await r.json().catch(()=>({items:[], total:0}));
    setMembers(Array.isArray(j.items) ? j.items : []);
    setTotal(Number(j.total || 0));
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await whoami();
      await checkRolesAccess(); // ✅ détermine si on affiche le bouton “Rôles & permissions”
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadMembers({ offset: 0 });
      void loadProposals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function delProposal(id: string) {
    if (!confirm('Supprimer cette proposition ?')) return;
    const r = await fetch('/api/admin/proposals', {
      method: 'DELETE',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ id })
    });
    if (!r.ok) {
      const j = await r.json().catch(()=>({}));
      alert(j.error || 'Suppression impossible');
      return;
    }
    await loadProposals();
  }

  async function createGlobalList() {
    if (!newGlobalName.trim()) return;
    const r = await fetch('/api/admin/lists', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name: newGlobalName.trim() })
    });
    if (!r.ok) { 
      const j = await r.json().catch(()=>({}));
      alert(j.error || 'Création impossible'); 
      return; 
    }
    setNewGlobalName('');
    alert('Liste générale créée ✅');
  }

  function showErrorMessage(code: string) {
    switch (code) {
      case 'username_taken': return 'Ce pseudo est déjà pris.';
      case 'forbidden_owner_only': return 'Action réservée au Owner.';
      case 'forbidden_higher_or_equal': return 'Cible de rang supérieur/égal.';
      case 'forbidden_cannot_grant_equal_or_higher': return 'Tu ne peux pas attribuer un rôle égal/supérieur au tien.';
      case 'last_owner_protected': return 'Impossible de retirer le dernier Owner du site.';
      case 'owner_always_admin': return 'Un Owner est toujours admin.';
      default: return 'Action impossible.';
    }
  }

  async function updateMember(m: Member, patch: Partial<Member>) {
    setBusyRow(m.id);
    const r = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ id: m.id, ...patch }),
    });
    setBusyRow(null);
    if (!r.ok) {
      const j = await r.json().catch(()=>({}));
      alert(showErrorMessage(j?.error));
      return;
    }
    await loadMembers();
  }

  async function deleteMember(m: Member) {
    if (!confirm(`Supprimer le membre "${m.username || m.id}" ?`)) return;
    const r = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ id: m.id }),
    });
    if (!r.ok) {
      const j = await r.json().catch(()=>({}));
      if (j?.error === 'service_role_absent') {
        alert('Suppression non configurée : définis SUPABASE_SERVICE_ROLE_KEY côté serveur.');
      } else {
        alert(showErrorMessage(j?.error));
      }
      return;
    }
    await loadMembers({ offset: 0 });
  }

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const paginatedInfo = useMemo(() => {
    if (total === 0) return '0';
    return `${offset + 1}–${Math.min(offset + limit, total)} / ${total}`;
  }, [offset, limit, total]);

  if (loading) return <div className="card p-4">Chargement…</div>;
  if (!isAdmin) return <div className="card p-4">Accès réservé aux administrateurs.</div>;

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold mb-1">Administration</h1>
            <p className="text-sm opacity-70">Gère les membres, listes et propositions.</p>
          </div>

          {/* ✅ Bouton d’accès à /admin/roles (Owner only) */}
          {canManageRoles && (
            <Link href="/admin/roles" className="btn btn-primary">
              Rôles & permissions
            </Link>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="card p-3">
            <div className="font-medium mb-2">Créer une liste générale</div>
            <div className="flex gap-2">
              <input className="border rounded-xl px-3 py-2 flex-1" placeholder="Nom de la liste"
                value={newGlobalName} onChange={(e)=>setNewGlobalName(e.target.value)} />
              <button className="btn btn-primary" onClick={createGlobalList}>Créer</button>
            </div>
            <p className="text-xs opacity-70 mt-2">Visible par tous (is_public) et gérée par l’admin.</p>
          </div>

          <div className="card p-3">
            <div className="font-medium mb-2">Infos</div>
            <p className="text-xs opacity-70">
              • Les actions sur les rôles respectent la hiérarchie (moderator &lt; admin &lt; owner).<br/>
              • Le <strong>Owner</strong> est unique et protégé (non assignable à autrui).<br/>
              • Les emails/mots de passe ne sont jamais modifiables ici.
            </p>
          </div>
        </div>
      </div>

      {/* Membres */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="font-medium">Membres</div>
          <div className="flex items-center gap-2">
            <input
              className="border rounded-xl px-3 py-2"
              placeholder="Rechercher par pseudo"
              value={search}
              onChange={(e)=> {
                setSearch(e.target.value);
                setOffset(0);
                const q = e.target.value;
                clearTimeout((window as any).__mdeb);
                (window as any).__mdeb = setTimeout(()=> loadMembers({ search: q, offset: 0 }), 300);
              }}
            />
            <div className="text-xs opacity-70">{paginatedInfo}</div>
            <button className="btn" disabled={!canPrev} onClick={()=>{
              const o = Math.max(0, offset - limit);
              setOffset(o);
              loadMembers({ offset: o });
            }}>Préc.</button>
            <button className="btn" disabled={!canNext} onClick={()=>{
              const o = offset + limit;
              setOffset(o);
              loadMembers({ offset: o });
            }}>Suiv.</button>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="text-sm opacity-70">Aucun membre.</div>
        ) : (
          <ul className="space-y-2">
            {members.map(m => (
              <li key={m.id} className="p-3 border rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate max-w-[240px]">
                      {m.username || <span className="opacity-60">(sans pseudo)</span>}
                    </div>
                    <RoleBadge role={m.role} />
                    {(m.is_admin || m.role === 'owner') && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">admin</span>
                    )}
                  </div>
                  <div className="text-xs opacity-70">Créé le {new Date(m.created_at).toLocaleDateString()}</div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {/* Changer pseudo */}
                  <input
                    className="border rounded-xl px-3 py-1 text-sm"
                    placeholder="Nouveau pseudo"
                    defaultValue={m.username || ''}
                    onBlur={(e)=> {
                      const val = e.target.value.trim();
                      if (val && val !== m.username) updateMember(m, { username: val });
                    }}
                  />

                  {/* Rôle */}
                  <select
                    className="border rounded-xl px-2 py-1 text-sm"
                    value={m.role || 'user'}
                    onChange={(e)=> updateMember(m, { role: e.target.value as Member['role'] })}
                  >
                    <option value="user">user</option>
                    <option value="moderator">moderator</option>
                    <option value="admin">admin</option>
                    <option value="owner">owner</option>
                  </select>

                  {/* is_admin (readonly si owner) */}
                  <label className="text-sm flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={!!m.is_admin || m.role === 'owner'}
                      disabled={m.role === 'owner'}
                      onChange={(e)=> updateMember(m, { is_admin: e.target.checked })}
                    />
                    admin
                  </label>

                  <button
                    className="btn btn-danger"
                    disabled={busyRow === m.id}
                    onClick={()=> deleteMember(m)}
                  >
                    {busyRow === m.id ? '…' : 'Supprimer'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Propositions récentes */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Propositions récentes</div>
        </div>
        {proposals.length === 0 ? (
          <div className="text-sm opacity-70">Aucune proposition.</div>
        ) : (
          <ul className="space-y-2">
            {proposals.map(p => (
              <li key={p.id} className="p-3 border rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.anime_title}</div>
                  <div className="text-xs opacity-70">
                    status: {p.status} • {new Date(p.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-danger" onClick={()=>delProposal(p.id)}>Supprimer</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
