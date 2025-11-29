// src/app/api/calendar/route.ts
import { NextRequest, NextResponse } from 'next/server';

type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

const ANILIST_URL = 'https://graphql.anilist.co';

async function anilistQuery<T>(query: string, variables: Record<string, any>): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`AniList error: ${res.status} ${msg}`);
  }
  const json = await res.json();
  return json.data as T;
}

const QUERY_SEASON = /* GraphQL */ `
query SeasonPage($season: MediaSeason!, $year: Int!, $page: Int!, $perPage: Int!) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage currentPage }
    media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC) {
      id
      title { romaji english native }
      episodes
      format
      status
      season
      seasonYear
      startDate { year month day }
      endDate { year month day }
      coverImage { large color }
      genres
      averageScore
      description(asHtml: false)
    }
  }
}
`;

function nextSeasons(n = 4): Array<{ season: Season; year: number; label: string }> {
  const map: Season[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const now = new Date();
  const m = now.getMonth(); // 0..11
  const idx = m <= 1 ? 0 : m <= 4 ? 1 : m <= 7 ? 2 : 3; // winter:0 spring:1 summer:2 fall:3
  let year = now.getFullYear();
  let s = map[idx];
  const out: Array<{ season: Season; year: number; label: string }> = [];
  for (let i = 0; i < n; i++) {
    out.push({
      season: s,
      year,
      label: `${s[0] + s.slice(1).toLowerCase()} ${year}`, // WINTER -> Winter
    });
    // advance
    const nextIdx = (map.indexOf(s) + 1) % 4;
    s = map[nextIdx];
    if (nextIdx === 0) year += 1;
  }
  return out;
}

async function fetchSeason(season: Season, year: number) {
  const perPage = 50;
  let page = 1;
  let items: any[] = [];
  // On boucle pour récupérer toutes les pages
  for (;;) {
    const data = await anilistQuery<{ Page: any }>(QUERY_SEASON, { season, year, page, perPage });
    const media = data?.Page?.media || [];
    items = items.concat(media);
    const hasNext = data?.Page?.pageInfo?.hasNextPage;
    if (!hasNext) break;
    page += 1;
    if (page > 5) break; // garde-fou
  }
  // mapping léger pour le front
  return items.map((m: any) => ({
    id: m.id,
    title: m.title?.english || m.title?.romaji || m.title?.native || 'Sans titre',
    titles: m.title,
    episodes: m.episodes,
    format: m.format,
    status: m.status,
    season: m.season,
    seasonYear: m.seasonYear,
    startDate: m.startDate,
    endDate: m.endDate,
    coverImage: m.coverImage,
    genres: m.genres,
    averageScore: m.averageScore,
    description: m.description,
  }));
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seasonParam = (searchParams.get('season') || '').toUpperCase() as Season;
  const yearParam = Number(searchParams.get('year') || '');
  const validSeason = (s: string): s is Season => ['WINTER', 'SPRING', 'SUMMER', 'FALL'].includes(s);

  try {
    // Cas 1 : saison précise demandée
    if (validSeason(seasonParam) && Number.isFinite(yearParam)) {
      const data = await fetchSeason(seasonParam, yearParam);
      return NextResponse.json({ season: seasonParam, year: yearParam, items: data }, { status: 200 });
    }

    // Cas 2 : renvoyer les 4 prochaines saisons groupées
    const groups = nextSeasons(4);
    const results = await Promise.all(groups.map(g => fetchSeason(g.season, g.year)));
    const payload = groups.map((g, i) => ({
      season: g.season,
      year: g.year,
      label: g.label,
      items: results[i],
    }));
    return NextResponse.json({ groups: payload }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
