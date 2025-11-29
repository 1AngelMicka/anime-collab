import { NextRequest, NextResponse } from "next/server";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const GQL = `
  query ($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
        id
        title { romaji english native }
        episodes
        seasonYear
        format
        genres
        coverImage { large }
        description(asHtml: false)
      }
    }
  }
`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  if (!q.trim()) return NextResponse.json({ items: [] });

  const res = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: GQL,
      variables: { search: q, page: 1, perPage: 10 },
    }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { items: [], error: "AniList error" },
      { status: 500 }
    );
  }

  const json = await res.json();
  return NextResponse.json({ items: json?.data?.Page?.media ?? [] });
}
