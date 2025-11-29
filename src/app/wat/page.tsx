// src/app/wat/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import SearchBar from '@/components/SearchBar'
import Title from '@/components/Title'
import AnimeCard from '@/components/AnimeCard'
import Badge from '@/components/Badge'
import Empty from '@/components/Empty'
import SkeletonRow from '@/components/SkeletonRow'
import Modal from '@/components/Modal'
import { supabaseBrowser } from '@/lib/supabase-browser'

type Proposal = {
  id: string
  list_id: string
  user_id: string
  anime_id: number
  anime_title: string
  anime_data: any
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  proposer_username?: string | null
}

type Group = { id: string; name: string; owner_id: string; my_role: 'owner'|'admin'|'member' }
type Member = { user_id: string; username: string | null; /* role supprimé d l’UI */ joined_at: string }

export default function Page() {
  const supabase = supabaseBrowser()

  // ===== Groupes =====
  const [groups, setGroups] = useState<Group[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [activeGroupRole, setActiveGroupRole] = useState<'owner'|'admin'|'member'|'none'>('none')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  // ===== Membres groupe =====
  const [members, setMembers] = useState<Member[]>([])
  // Auto-complétion (invitation)
  const [inviteQuery, setInviteQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ id: string; username: string | null }[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const suggestWrapRef = useRef<HTMLDivElement | null>(null)

  // ===== Liste liée au groupe =====
  const [listId, setListId] = useState<string | null>(null)

  // ===== Propositions =====
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [booting, setBooting] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  // ===== Droits (héritage) =====
  const [meId, setMeId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [listOwnerId, setListOwnerId] = useState<string | null>(null)
  const [listUserId, setListUserId] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)

  const iAmOwnerOrUserOfList = useMemo(
    () => !!meId && (meId === listOwnerId || meId === listUserId),
    [meId, listOwnerId, listUserId]
  )
  const canModerateBase = useMemo(
    () => isAdmin || iAmOwnerOrUserOfList || isMember,
    [isAdmin, iAmOwnerOrUserOfList, isMember]
  )

  // ===== Toast/banner simple =====
  const [banner, setBanner] = useState<string | null>(null)
  function toast(msg: string) {
    setBanner(msg)
    setTimeout(() => setBanner(null), 2500)
  }

  // ===== Helpers =====
  async function loadMe() {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' })
      const j = await r.json().catch(() => ({ user: null }))
      setMeId(j?.user?.id || null)
    } catch {}
    try {
      // whoami/whoaami compat
      let r2 = await fetch('/api/admin/whoami', { cache: 'no-store' })
      if (!r2.ok) r2 = await fetch('/api/admin/whoaami', { cache: 'no-store' })
      const j2 = await r2.json().catch(() => ({ is_admin: false }))
      setIsAdmin(!!j2.is_admin)
    } catch {}
  }

  async function loadGroups() {
    try {
      const r = await fetch('/api/groups', { cache: 'no-store' })
      const j = await r.json().catch(() => ({ groups: [] }))
      const gs: Group[] = Array.isArray(j.groups) ? j.groups : []
      setGroups(gs)
      const saved = typeof window !== 'undefined' ? localStorage.getItem('active_group_id') : null
      const target = (saved && gs.some(g => g.id === saved)) ? saved : (gs[0]?.id || null)
      setActiveGroupId(target)
      const role = gs.find(g => g.id === target)?.my_role || 'none'
      setActiveGroupRole(role as any)
      if (target) localStorage.setItem('active_group_id', target)
    } catch {
      setGroups([])
      setActiveGroupId(null)
      setActiveGroupRole('none')
    }
  }

  async function ensureListForGroup(gid: string) {
    const r = await fetch(`/api/lists/ensure-default?group_id=${encodeURIComponent(gid)}`, { cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j?.listId) {
      setListId(null)
    } else {
      setListId(j.listId)
    }
  }

  async function loadListInfo(lid: string) {
    try {
      const r = await fetch(`/api/lists/info?id=${encodeURIComponent(lid)}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      setListOwnerId(j?.list?.owner_id || null)
      setListUserId(j?.list?.user_id || null)
      setIsMember(false)
      if (Array.isArray(j?.members) && meId) {
        setIsMember(j.members.some((m: any) => m.user_id === meId))
      }
    } catch {
      setListOwnerId(null)
      setListUserId(null)
      setIsMember(false)
    }
  }

  async function loadMembers(gid: string) {
    try {
      const r = await fetch(`/api/groups/members?group_id=${encodeURIComponent(gid)}`, { cache: 'no-store' })
      const j = await r.json().catch(()=> ({}))
      setMembers(Array.isArray(j.members) ? j.members : [])
    } catch {
      setMembers([])
    }
  }

  async function refresh(lid?: string) {
    const target = lid || listId
    if (!target) { setProposals([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/proposals?list_id=${encodeURIComponent(target)}`, { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      setProposals(Array.isArray(j.proposals) ? j.proposals : [])
    } catch {
      setProposals([])
    } finally {
      setLoading(false)
    }
  }

  // ===== Boot =====
  useEffect(() => {
    (async () => {
      setBooting(true)
      await loadMe()
      await loadGroups()
      setBooting(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Groupe actif change
  useEffect(() => {
    if (!activeGroupId) return
    localStorage.setItem('active_group_id', activeGroupId)
    const role = groups.find(g => g.id === activeGroupId)?.my_role || 'none'
    setActiveGroupRole(role as any)
    ;(async () => {
      await ensureListForGroup(activeGroupId)
      await loadMembers(activeGroupId)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, groups])

  // Liste change
  useEffect(() => {
    if (!listId) return
    ;(async () => {
      await loadListInfo(listId)
      await refresh(listId)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId])

  // ===== Auto-complétion users (invite) =====
  useEffect(() => {
    if (!showSuggest) return
    const timer = setTimeout(async () => {
      try {
        setLoadingSuggest(true)
        const r = await fetch('/api/users/suggest?q=' + encodeURIComponent(inviteQuery))
        const j = await r.json().catch(() => ({ items: [] }))
        setSuggestions(Array.isArray(j.items) ? j.items : [])
      } finally {
        setLoadingSuggest(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [inviteQuery, showSuggest])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!suggestWrapRef.current) return
      if (!suggestWrapRef.current.contains(e.target as Node)) setShowSuggest(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // ===== Actions propositions =====
  async function onPick(media: any): Promise<boolean> {
    if (!listId) { alert('Aucune liste prête pour ce groupe.'); return false }
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_id: listId, anime: media }),
      })
      const j = await res.json().catch(() => ({} as any))
      if (!res.ok) {
        alert(j.error || 'Erreur lors de la proposition')
        return false
      }
      await refresh(listId)
      return true
    } catch {
      alert('Erreur réseau')
      return false
    }
  }

  async function setStatus(id: string, status: 'approved' | 'rejected' | 'pending') {
    try {
      const res = await fetch('/api/proposals/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const j = await res.json().catch(() => ({} as any))
      if (!res.ok) {
        alert(j.error || 'Erreur lors de la mise à jour du statut')
        return
      }
      await refresh()
    } catch {
      alert('Erreur réseau')
    }
  }

  async function markSeen(anime: any) {
    try {
      const r = await fetch('/api/watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anime }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        alert(j.error || 'Erreur')
        return
      }
      toast('Ajouté à tes animés vus ✅')
    } catch {
      alert('Erreur réseau')
    }
  }

  async function delProposal(id: string) {
    if (!confirm('Supprimer cette proposition ?')) return
    try {
      const r = await fetch('/api/proposals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        alert(j.error || 'Suppression impossible')
        return
      }
      await refresh()
    } catch {
      alert('Erreur réseau')
    }
  }

  function openDetails(m: any) {
    setSelected(m)
    setModalOpen(true)
  }

  // ===== Actions groupes / membres =====
  async function createGroup() {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    try {
      const r = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ name: newGroupName.trim() })
      })
      const j = await r.json().catch(()=> ({}))
      if (!r.ok) { alert(j.error || 'Création impossible'); return }
      setNewGroupName('')
      await loadGroups()
      if (j.group_id) setActiveGroupId(j.group_id)
      toast('Groupe créé ✅')
    } finally {
      setCreatingGroup(false)
    }
  }

  async function inviteMemberFromQuery() {
    if (!activeGroupId || !inviteQuery.trim()) return
    try {
      const r = await fetch('/api/groups/members', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          group_id: activeGroupId,
          usernameOrEmail: inviteQuery.trim(),
          role: 'member' // pas de rôles avancés côté groupes
        })
      })
      const j = await r.json().catch(()=> ({}))
      if (!r.ok) { alert(j.error || 'Invitation impossible'); return }
      setInviteQuery('')
      setShowSuggest(false)
      await loadMembers(activeGroupId)
      toast('Invitation envoyée ✅')
    } catch {
      alert('Erreur réseau')
    }
  }

  async function removeMember(targetUserId: string) {
    if (!activeGroupId) return
    if (!confirm('Retirer ce membre du groupe ?')) return
    try {
      const r = await fetch('/api/groups/members', {
        method: 'DELETE',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ group_id: activeGroupId, user_id: targetUserId })
      })
      const j = await r.json().catch(()=> ({}))
      if (!r.ok) { alert(j.error || 'Suppression impossible'); return }
      await loadMembers(activeGroupId)
      toast('Membre retiré ✅')
    } catch {
      alert('Erreur réseau')
    }
  }

  async function leaveGroup() {
    if (!activeGroupId || !meId) return
    if (!confirm('Quitter ce groupe ?')) return
    try {
      const r = await fetch('/api/groups/members', {
        method: 'DELETE',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ group_id: activeGroupId, user_id: meId })
      })
      const j = await r.json().catch(()=> ({}))
      if (!r.ok) { alert(j.error || 'Action impossible'); return }
      await loadGroups()
      if (groups.length === 0) {
        setActiveGroupId(null)
        setMembers([])
        setListId(null)
      }
      toast('Tu as quitté le groupe ✅')
    } catch {
      alert('Erreur réseau')
    }
  }

  async function deleteGroup() {
    if (!activeGroupId) return
    if (!confirm('Supprimer définitivement ce groupe ?')) return
    try {
      const r = await fetch('/api/groups', {
        method: 'DELETE',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ group_id: activeGroupId })
      })
      const j = await r.json().catch(()=> ({}))
      if (!r.ok) { alert(j.error || 'Suppression impossible'); return }
      await loadGroups()
      setMembers([])
      setListId(null)
      toast('Groupe supprimé ✅')
    } catch {
      alert('Erreur réseau')
    }
  }

  const pending = useMemo(() => proposals.filter((p) => p.status === 'pending'), [proposals])
  const approved = useMemo(() => proposals.filter((p) => p.status === 'approved'), [proposals])

  if (booting) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-semibold mb-2">Initialisation…</h1>
        <div className="space-y-2">
          <SkeletonRow /><SkeletonRow /><SkeletonRow />
        </div>
      </div>
    )
  }

  const iAmOwner = activeGroupRole === 'owner'
  const iAmAdmin  = activeGroupRole === 'admin'

  return (
    <div className="space-y-4">
      {/* Banner / toast */}
      {banner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-sm px-3 py-2 rounded-full shadow">
          {banner}
        </div>
      )}

      {/* Barre Groupe avec actions */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <div className="font-medium mb-1">Groupe</div>
            <div className="flex flex-wrap gap-2">
              {groups.length === 0 ? (
                <div className="text-sm opacity-70">Aucun groupe pour le moment.</div>
              ) : (
                groups.map(g => (
                  <button
                    key={g.id}
                    className={`btn text-sm ${activeGroupId === g.id ? 'btn-primary' : ''}`}
                    onClick={() => setActiveGroupId(g.id)}
                    title={`Rôle: ${g.my_role}`}
                  >
                    {g.name}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              className="border rounded-xl px-3 py-2"
              placeholder="Créer un groupe"
              value={newGroupName}
              onChange={e=>setNewGroupName(e.target.value)}
              onKeyDown={(e)=>{ if (e.key === 'Enter') createGroup() }}
            />
            <button className="btn btn-primary" onClick={createGroup} disabled={creatingGroup}>
              {creatingGroup ? '…' : 'Créer'}
            </button>
          </div>

          {activeGroupId && (
            <div className="flex gap-2">
              <button className="btn" onClick={leaveGroup}>Quitter le groupe</button>
              {iAmOwner && (
                <button className="btn btn-danger" onClick={deleteGroup}>Supprimer le groupe</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grille à 4 colonnes : Membres / Propositions (2 cols) / Liste principale */}
      <div className="grid md:grid-cols-4 gap-4">
        {/* Membres */}
        <aside className="md:col-span-1 space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <Title>Liste des membres</Title>
              <Badge>{members.length}</Badge>
            </div>

            {members.length === 0 ? (
              <Empty title="Aucun membre" hint="Invite quelqu’un pour collaborer." />
            ) : (
              <ul className="space-y-2">
                {members.map(m => (
                  <li key={m.user_id} className="p-2 border rounded-xl flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {m.username || m.user_id.slice(0,8)}
                      </div>
                    </div>
                    {(iAmOwner || iAmAdmin) && (
                      <button
                        className="btn btn-danger"
                        onClick={() => removeMember(m.user_id)}
                      >
                        Retirer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Inviter — auto-complétion */}
            {activeGroupId && (
              <div className="mt-3 border-t pt-3" ref={suggestWrapRef}>
                <div className="font-medium mb-2">Inviter un membre</div>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <input
                      className="border rounded-xl px-3 py-2 w-full"
                      placeholder="Tape un pseudo (ex: Angel)"
                      value={inviteQuery}
                      onFocus={() => setShowSuggest(true)}
                      onChange={(e) => setInviteQuery(e.target.value)}
                      onKeyDown={(e)=>{ if (e.key==='Enter') inviteMemberFromQuery() }}
                    />
                    {showSuggest && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-auto border rounded-xl bg-white shadow">
                        {loadingSuggest ? (
                          <div className="p-3 text-sm opacity-70">Chargement…</div>
                        ) : suggestions.length === 0 ? (
                          <div className="p-3 text-sm opacity-70">Aucun résultat</div>
                        ) : (
                          <ul>
                            {suggestions.map(u => (
                              <li
                                key={u.id}
                                className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                                onClick={() => {
                                  setInviteQuery(u.username || '')
                                  setShowSuggest(false)
                                }}
                              >
                                <span className="truncate">{u.username || u.id.slice(0,8)}</span>
                                <span className="ml-3 text-[10px] opacity-60">{u.id.slice(0,8)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                  <button className="btn btn-primary shrink-0" onClick={inviteMemberFromQuery}>
                    Inviter
                  </button>
                </div>
                <div className="text-xs opacity-60 mt-1">
                  Saisis le pseudo de la personne que tu veux inviter.
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Propositions / Validés */}
        <section className="md:col-span-2 space-y-4">
          <SearchBar onPick={onPick} />

          {/* Propositions */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <Title>Propositions</Title>
              <Badge color="amber">{pending.length}</Badge>
            </div>
            {loading ? (
              <div className="space-y-2"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
            ) : pending.length === 0 ? (
              <Empty title="Aucune proposition" hint="Propose un animé via la barre de recherche ci-dessus." />
            ) : (
              <ul className="space-y-2">
                {pending.map((p) => {
                  const m = p.anime_data
                  const title = m?.title?.english || m?.title?.romaji || p.anime_title
                  const meta = [m?.format, m?.episodes ? `${m.episodes} épisodes` : null, m?.genres?.slice(0,3)?.join(' · ')].filter(Boolean).join(' • ')
                  const canModerate = canModerateBase
                  const isProposer = !!meId && p.user_id === meId
                  return (
                    <li key={p.id}>
                      <AnimeCard cover={m?.coverImage?.large} title={title} meta={meta}>
                        <div className="text-xs opacity-60 mb-1">
                          {p.proposer_username ? `Proposé par ${p.proposer_username}` : 'Proposé'}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <button className="btn" onClick={() => openDetails(m)}>Détails</button>
                          <button className="btn" onClick={() => markSeen(m)}>Déjà vu</button>
                          {canModerate && !isProposer && (
                            <>
                              <button className="btn btn-primary" onClick={() => setStatus(p.id, 'approved')}>Valider</button>
                              <button className="btn btn-danger" onClick={() => setStatus(p.id, 'rejected')}>Refuser</button>
                              <button className="btn btn-danger" onClick={() => delProposal(p.id)}>Supprimer</button>
                            </>
                          )}
                        </div>
                      </AnimeCard>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Validés */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <Title>Validés</Title>
              <Badge color="green">{approved.length}</Badge>
            </div>
            {approved.length === 0 ? (
              <Empty title="Aucun validé" hint="Valide une proposition pour l’ajouter à la liste." />
            ) : (
              <ul className="space-y-2">
                {approved.map((p) => {
                  const m = p.anime_data
                  const title = m?.title?.english || m?.title?.romaji || p.anime_title
                  const meta = [m?.episodes ? `${m.episodes} épisodes` : null, m?.genres?.slice(0,3)?.join(' · ')].filter(Boolean).join(' • ')
                  const canModerate = canModerateBase
                  const isProposer = !!meId && p.user_id === meId
                  return (
                    <li key={p.id}>
                      <AnimeCard cover={m?.coverImage?.large} title={title} meta={meta}>
                        <div className="text-xs opacity-60 mb-1">
                          {p.proposer_username ? `Proposé par ${p.proposer_username}` : 'Proposé'}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <button className="btn" onClick={() => openDetails(m)}>Détails</button>
                          <button className="btn" onClick={() => markSeen(m)}>Déjà vu</button>
                          {canModerate && !isProposer && (
                            <button className="btn btn-danger" onClick={() => delProposal(p.id)}>Supprimer</button>
                          )}
                        </div>
                      </AnimeCard>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Liste principale (compact/empilé) */}
        <aside className="md:col-span-1 space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <Title>Liste principale</Title>
              <Badge>{approved.length}</Badge>
            </div>
            {approved.length === 0 ? (
              <Empty title="Liste vide" hint="Valide une proposition pour l’ajouter ici." />
            ) : (
              <ul className="space-y-2">
                {approved.map((p) => {
                  const m = p.anime_data
                  const title = m?.title?.english || m?.title?.romaji || p.anime_title
                  const meta = m?.genres?.slice(0,3)?.join(' · ')
                  const canModerate = canModerateBase
                  const isProposer = !!meId && p.user_id === meId
                  return (
                    <li key={p.id}>
                      <AnimeCard variant="stacked" cover={m?.coverImage?.large} title={title} meta={meta}>
                        <div className="text-xs opacity-60">Proposé</div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <button className="btn" onClick={() => openDetails(m)}>Détails</button>
                          <button className="btn" onClick={() => markSeen(m)}>Déjà vu</button>
                          {canModerate && !isProposer && (
                            <button className="btn btn-danger" onClick={() => delProposal(p.id)}>Supprimer</button>
                          )}
                        </div>
                      </AnimeCard>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Modale Détails */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Détails de l’animé">
        {!selected ? null : (
          <div className="flex gap-3">
            <img src={selected?.coverImage?.large} className="w-20 h-28 rounded-xl object-cover" alt="" />
            <div>
              <div className="font-semibold">{selected?.title?.english || selected?.title?.romaji}</div>
              <div className="text-xs opacity-70">
                {[selected?.format, selected?.episodes ? `${selected.episodes} épisodes` : null, selected?.genres?.slice(0,3)?.join(' · ')].filter(Boolean).join(' • ')}
              </div>
              <p className="text-sm mt-2 max-h-60 overflow-auto whitespace-pre-wrap">
                {selected?.description}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
