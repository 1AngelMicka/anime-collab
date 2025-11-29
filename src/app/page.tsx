'use client';

export const dynamic = 'force-dynamic';

type NewsItem = {
  id: string;
  title: string;
  url?: string;
  date?: string;
  source?: string;
  image?: string;
};

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

function AboutBox() {
  return (
    <aside className="card p-4 space-y-2">
      <h2 className="text-xl font-semibold">À propos</h2>
      <p className="text-sm opacity-80">
        <strong>Watch Anime Together</strong> est un espace pour décider à plusieurs quoi regarder :
        propose des animés, vote, valide ou refuse, et tiens une liste commune.
      </p>
      <ul className="text-sm list-disc pl-5 opacity-80">
        <li>Propositions collaboratives</li>
        <li>Validation / refus avec rôles</li>
        <li>Suivi des animés déjà vus</li>
        <li>Listes personnelles et partagées</li>
      </ul>
    </aside>
  );
}

/**
 * NEWS CAROUSEL
 * - 8 news max (image + titre overlay)
 * - Méta ("il y a X heures • source") AU-DESSUS
 * - Auto-défilement 5s, pause au survol
 * - Barres (timer) limitées à 6 : la barre active se remplit sur 5s
 */
function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const slideStartRef = useRef<number>(Date.now());
  const isHoverRef = useRef(false);

  const AUTO_MS = 5000;
  const MAX_BARS = 6;

  // tick pour animer les barres
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch('/api/news', { cache: 'no-store' });
        const j = await r.json().catch(() => ({ items: [] }));
        const list: NewsItem[] = Array.isArray(j.items) ? j.items : [];
        setItems(list);
      } catch (e) {
        setErr('Impossible de charger les actualités.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto avance + tick animation
  useEffect(() => {
    const t = setInterval(() => {
      if (!isHoverRef.current) {
        setTick((x) => x + 1);
        const elapsed = Date.now() - slideStartRef.current;
        if (elapsed >= AUTO_MS && items.length > 0) {
          setIndex((i) => (i + 1) % items.length);
          slideStartRef.current = Date.now();
        }
      }
    }, 100); // 10 fps suffit pour un timer
    return () => clearInterval(t);
  }, [items.length]);

  const onMouseEnter = () => { isHoverRef.current = true; };
  const onMouseLeave = () => { isHoverRef.current = false; };

const jumpTo = (i: number) => {
  setIndex(i);                        // change immédiatement de slide
  slideStartRef.current = Date.now(); // reset le timer
  setTick((x) => x + 1);              // force un re-render immédiat → barre à 0% instantanément
};


  // 4 visibles, à partir de index
  const visible = useMemo(() => {
    if (items.length === 0) return [];
    const out: NewsItem[] = [];
    for (let k = 0; k < Math.min(4, items.length); k++) {
      out.push(items[(index + k) % items.length]);
    }
    return out;
  }, [items, index]);

  // Barres limitées
  const barsCount = Math.min(items.length, MAX_BARS);
  const activeBar = items.length ? (index % barsCount) : 0;

  // progress 0..1 pour la barre active
  const progress = Math.min(1, Math.max(0, (Date.now() - slideStartRef.current) / AUTO_MS));

  const hoursAgo = (iso?: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.max(0, Math.round(diff / 36e5));
    return `Il y a ${h} heure${h>1?'s':''}`;
  };

  return (
    <section className="card p-4 space-y-3" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Actualités</h2>
        <span className="text-xs opacity-60">{items.length} articles</span>
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-gray-200 rounded-2xl" />
          ))}
        </div>
      ) : err ? (
        <div className="text-sm text-red-600">{err}</div>
      ) : items.length === 0 ? (
        <div className="text-sm opacity-70">Aucune actu pour le moment.</div>
      ) : (
        <>
          {/* Méta au-dessus (du 1er visible) */}
          <div className="text-[12px] opacity-70">
            {visible[0]?.date ? hoursAgo(visible[0].date) : ''}
            {visible[0]?.source ? ` • ${visible[0].source}` : ''}
          </div>

{/* Grille 4 tuiles */}
<div className="grid lg:grid-cols-4 md:grid-cols-2 gap-3">
  {visible.map((n) => (
    <article
      key={n.id}
      className="relative rounded-2xl overflow-hidden bg-zinc-900 transform transition-transform duration-300 hover:scale-105"
    >
      {n.image ? (
        <img src={n.image} alt="" className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gray-300" />
      )}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        <h3 className="text-white font-semibold leading-tight text-sm line-clamp-2 drop-shadow">
          {n.title}
        </h3>
      </div>
      {n.url && (
        <a
          href={n.url}
          target="_blank"
          className="absolute inset-0"
          aria-label="Ouvrir l’article"
        />
      )}
    </article>
  ))}
</div>


{/* Barres (timer) limitées à 6 */}
<div className="flex items-center justify-center gap-2 pt-2">
  {Array.from({ length: barsCount }).map((_, i) => {
    const isActive = i === activeBar;
    const w = isActive ? `${Math.round(progress * 100)}%` : '0%';
    return (
      <button
        key={i}
        aria-label={`Aller au slide ${i + 1}`}
        onClick={() => jumpTo(i)}
        className="group relative w-16 sm:w-20 h-2 rounded-full overflow-hidden 
                   bg-gray-300 transition-transform duration-200 cursor-pointer
                   hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
        title={`Actu ${i + 1}`}
      >
        {/* fond subtle pour le timer */}
        <span className="absolute inset-0 bg-gray-200/60" />
        {/* barre de progression */}
        <span
          className={`absolute inset-y-0 left-0 ${isActive ? 'bg-blue-500' : 'bg-transparent'}`}
          style={{
            width: w,
            transition: isActive ? 'width 100ms linear' : 'none',
          }}
        />
        {/* liseré au survol */}
        <span className="absolute inset-0 ring-0 group-hover:ring-1 ring-blue-400/40 rounded-full pointer-events-none" />
      </button>
    );
  })}
</div>

        </>
      )}
    </section>
  );
}

function SeasonTabs() {
  type CalendarItem = {
    id: number;
    title: string;
    titles?: { english?: string; romaji?: string; native?: string };
    episodes?: number | null;
    format?: string | null;
    status?: string | null;
    season?: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
    seasonYear?: number;
    startDate?: { year?: number; month?: number; day?: number };
    endDate?: { year?: number; month?: number; day?: number };
    coverImage?: { large?: string; color?: string };
    genres?: string[];
    averageScore?: number | null;
    description?: string | null;
  };

  type Tab = { season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'; year: number };

  const frSeason = (s: Tab['season']) =>
    s === 'WINTER' ? 'Hiver' :
    s === 'SPRING' ? 'Printemps' :
    s === 'SUMMER' ? 'Été' :
    'Automne';

  // --- Helper: point de départ = saison "courante" avec seuil mi-septembre pour FALL
  const computeTabs = (): { tabs: Tab[]; initialIndex: number } => {
    const map: Tab['season'][] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0..11
    const d = now.getDate();

    // Règle standard: hiver(Jan–Mar), printemps(Avr–Juin), été(Juil–Sep), automne(Oct–Déc)
    // Ajustement demandé: à partir du 15 septembre => considérer AUTOMNE comme "en cours".
    let idx: number;
    if (m <= 2) idx = 0;          // Jan,Feb,Mar -> WINTER
    else if (m <= 5) idx = 1;     // Apr,May,Jun -> SPRING
    else if (m <= 7) idx = 2;     // Jul,Aug    -> SUMMER
    else if (m === 8) {           // September
      idx = (d >= 15) ? 3 : 2;    // <= réglage: dès le 15/09 on bascule sur FALL
    } else {
      idx = 3;                    // Oct..Dec -> FALL
    }

    const start: Tab = { season: map[idx], year: y };
    // Ajuste l'année si on “passe” de Déc -> Hiver suivant quand on déroule
    const tabs: Tab[] = [start];
    for (let i = 1; i < 4; i++) {
      const prev = tabs[i - 1];
      const nextIdx = (map.indexOf(prev.season) + 1) % 4;
      const nextSeason = map[nextIdx];
      const nextYear = nextIdx === 0 ? prev.year + 1 : prev.year;
      tabs.push({ season: nextSeason, year: nextYear });
    }

    return { tabs, initialIndex: 0 };
  };

  const { tabs, initialIndex } = computeTabs();
  const [active, setActive] = useState<number>(initialIndex);
  const [cache, setCache] = useState<Record<string, { items: CalendarItem[]; loaded: boolean; error?: string }>>({});
  const keyOf = (t: Tab) => `${t.season}-${t.year}`;

  async function loadTab(i: number) {
    const t = tabs[i];
    const key = keyOf(t);
    if (cache[key]?.loaded) return;
    setCache((c) => ({ ...c, [key]: { items: [], loaded: false, error: undefined } }));
    try {
      const r = await fetch(`/api/calendar?season=${t.season}&year=${t.year}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      const items: CalendarItem[] = Array.isArray(j.items) ? j.items : [];
      setCache((c) => ({ ...c, [key]: { items, loaded: true } }));
    } catch (e: any) {
      setCache((c) => ({ ...c, [key]: { items: [], loaded: true, error: 'Impossible de charger cette saison.' } }));
    }
  }

  useEffect(() => { loadTab(active); /* charge l’onglet initial */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTab = tabs[active];
  const activeKey = keyOf(activeTab);
  const state = cache[activeKey] || { items: [], loaded: false as const };

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Calendrier saisonnier</h2>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t, i) => (
            <button
              key={keyOf(t)}
              className={`btn text-xs ${i === active ? 'btn-primary' : ''}`}
              onClick={() => { setActive(i); void loadTab(i); }}
              title={`${frSeason(t.season)} ${t.year}`}
            >
              {frSeason(t.season)} {t.year}
            </button>
          ))}
        </div>
      </div>

      {!state.loaded ? (
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
        </div>
      ) : state.error ? (
        <div className="text-sm text-red-600">{state.error}</div>
      ) : state.items.length === 0 ? (
        // Message UX si aucune entrée (ex: juste avant le début de saison)
        <div className="text-sm opacity-70">
          Aucune sortie listée pour cette saison pour le moment. Les annonces arrivent souvent en décalé —
          repasse bientôt !
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-2">
          {state.items.map((it) => {
            const title =
              it.title ||
              it.titles?.english ||
              it.titles?.romaji ||
              it.titles?.native ||
              'Sans titre';

            const meta = [
              it.format || null,
              typeof it.episodes === 'number' && it.episodes > 0 ? `${it.episodes} ép.` : null,
              Array.isArray(it.genres) ? it.genres.slice(0, 3).join(' · ') : null,
            ].filter(Boolean).join(' • ');

            const sd = it.startDate;
            const d = sd?.year && sd?.month && sd?.day
              ? new Date(sd.year, (sd.month as number) - 1, sd.day)
              : null;

            return (
              <li key={it.id} className="p-3 border rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {it.coverImage?.large && (
                    <img src={it.coverImage.large} alt="" className="w-14 h-20 rounded-lg object-cover" />
                  )}
                  <div>
                    <div className="font-medium">{title}</div>
                    <div className="text-xs opacity-70">{meta}</div>
                    <div className="text-[11px] opacity-60">
                      {d ? d.toLocaleDateString() : 'Date à venir'}
                    </div>
                  </div>
                </div>
                <button className="btn">Détails</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}




export default function HomePage() {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <NewsFeed />
        <SeasonTabs />
      </div>
      <div className="lg:col-span-1">
        <AboutBox />
      </div>
    </div>
  );
}
