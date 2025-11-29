// src/app/api/news/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// RSS Crunchyroll FR
const FEED_URL = 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/fr-FR/rss';

type RawItem = {
  title: string;
  link?: string;
  pubDate?: string;
  image?: string;
  source?: string;
};

// --- utils: decode HTML entities (&amp;, &#039;, &#x27; …)
function decodeHtml(input?: string): string {
  if (!input) return '';
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: '\u00a0',
  };
  return input
    // named entities
    .replace(/&([a-z]+);/gi, (_, n: string) => (named[n.toLowerCase()] ?? `&${n};`))
    // decimal entities
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    // hex entities
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)));
}

// Parse simple RSS + extraction d'image (media:thumbnail, enclosure, description/content img)
function parseRss(xml: string): RawItem[] {
  const items: RawItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  const pick = (block: string, tag: string) => {
    const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
    return r ? r[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : undefined;
  };

  const pickAttr = (block: string, tag: string, attr: string) => {
    const r = new RegExp(`<${tag}[^>]*${attr}="([^"]+)"[^>]*\\/?>`, 'i').exec(block);
    return r ? r[1] : undefined;
  };

  const firstImgFromHtml = (html?: string) => {
    if (!html) return undefined;
    const r =
      /<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp|gif))"[^>]*>/i.exec(html) ||
      /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i.exec(html);
    return r ? r[1] : undefined;
  };

  while ((m = itemRegex.exec(xml))) {
    const block = m[1];
    const title = decodeHtml(pick(block, 'title') || 'Sans titre');
    const link = pick(block, 'link');
    const pubDate = pick(block, 'pubDate') || pick(block, 'dc:date');

    // Essayer media:thumbnail, enclosure, puis <description> / <content:encoded>
    const imgMedia = pickAttr(block, 'media:thumbnail', 'url');
    const imgEnclosure = pickAttr(block, 'enclosure', 'url');
    const desc = pick(block, 'description');
    const content = pick(block, 'content:encoded');

    const imgDesc = firstImgFromHtml(desc);
    const imgContent = firstImgFromHtml(content);

    const image = imgMedia || imgEnclosure || imgContent || imgDesc;

    items.push({
      title,
      link,
      pubDate,
      image,
      source: 'Crunchyroll',
    });
  }
  return items;
}

// Fallback: si pas d'image dans le flux, essayer l'og:image
async function fetchOgImage(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return undefined;
    const html = await res.text();
    const m =
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html) ||
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
    return m ? m[1] : undefined;
  } catch {
    return undefined;
  }
}

export async function GET() {
  try {
    const res = await fetch(FEED_URL, { cache: 'no-store' });
    const xml = await res.text();

    const raw = parseRss(xml);

    // Si pas d'image → tenter og:image (limite 12 pour rester raisonnable)
    const withFallback = await Promise.all(
      raw.slice(0, 12).map(async (it) => {
        if (it.image) return it;
        const og = await fetchOgImage(it.link);
        return { ...it, image: og };
      })
    );

    const items = withFallback
      .map((it) => ({
        id: (it.link || it.title) + (it.pubDate || ''),
        title: decodeHtml(it.title),
        url: it.link,
        date: it.pubDate ? new Date(it.pubDate).toISOString() : undefined,
        source: it.source,
        image: it.image,
      }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 8); // <= 8 dernières news

    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || 'fetch_failed' }, { status: 200 });
  }
}
