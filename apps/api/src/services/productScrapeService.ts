/**
 * Fetch a public product page and extract basic fields (regex / JSON-LD; no browser).
 * Mirrors website scraper fetch pattern: AbortSignal timeout, User-Agent, redirect follow.
 */

const FETCH_TIMEOUT_MS = 8000;
const HTML_MAX = 2_000_000;

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t.startsWith('http://') || t.startsWith('https://') ? t : `https://${t}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function metaByProperty(html: string, prop: string): string {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m =
    html.match(new RegExp(`<meta[^>]+property=["']${esc}["'][^>]+content=["']([^"']*)["']`, 'i')) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${esc}["']`, 'i'));
  return m?.[1] ? decodeBasicEntities(m[1].trim()) : '';
}

function metaByName(html: string, name: string): string {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m =
    html.match(new RegExp(`<meta[^>]+name=["']${esc}["'][^>]+content=["']([^"']*)["']`, 'i')) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${esc}["']`, 'i'));
  return m?.[1] ? decodeBasicEntities(m[1].trim()) : '';
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1] ? decodeBasicEntities(stripTags(m[1]).trim()) : '';
}

function extractH1(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m?.[1]) return '';
  return decodeBasicEntities(stripTags(m[1]).trim());
}

function firstLongParagraph(html: string): string {
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]).trim();
    if (text.length > 50) return decodeBasicEntities(text.slice(0, 2000));
  }
  return '';
}

function absolutize(src: string, baseHref: string): string | null {
  const t = src.trim();
  if (!t || t.startsWith('data:')) return null;
  try {
    return new URL(t, baseHref).href;
  } catch {
    return null;
  }
}

function extractOgImage(html: string, baseHref: string): string | null {
  const raw = metaByProperty(html, 'og:image');
  if (!raw) return null;
  return absolutize(raw, baseHref);
}

function extractFirstImg(html: string, baseHref: string): string | null {
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const abs = absolutize(m[1], baseHref);
    if (abs && /^https?:\/\//i.test(abs)) return abs;
  }
  return null;
}

const PRICE_RE = /[\$£€]\s?\d+(?:\.\d{2})?/;

function priceFromText(text: string): string | null {
  const m = text.match(PRICE_RE);
  return m ? m[0].replace(/\s+/g, ' ').trim() : null;
}

function extractJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }
  return out;
}

interface ProductLd {
  name?: string;
  description?: string;
  image?: string;
  price?: string;
}

function walkLdProduct(node: unknown): ProductLd | null {
  if (node === null || typeof node !== 'object') return null;
  const o = node as Record<string, unknown>;
  const types = o['@type'];
  const typeStr = Array.isArray(types) ? types.map(String).join(',') : String(types ?? '');
  if (/\bProduct\b/i.test(typeStr)) {
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const description = typeof o.description === 'string' ? o.description.trim() : '';
    let image: string | undefined;
    if (typeof o.image === 'string') image = o.image.trim();
    else if (Array.isArray(o.image) && typeof o.image[0] === 'string') image = String(o.image[0]).trim();
    let price: string | undefined;
    const offers = o.offers;
    if (offers && typeof offers === 'object' && !Array.isArray(offers)) {
      const off = offers as Record<string, unknown>;
      if (typeof off.price === 'number') price = String(off.price);
      else if (typeof off.price === 'string') price = off.price;
    } else if (Array.isArray(offers) && offers[0] && typeof offers[0] === 'object') {
      const off = offers[0] as Record<string, unknown>;
      if (typeof off.price === 'number') price = String(off.price);
      else if (typeof off.price === 'string') price = off.price;
    }
    return {
      name: name || undefined,
      description: description || undefined,
      image,
      price: price ? (PRICE_RE.test(price) ? price.match(PRICE_RE)?.[0] ?? price : price) : undefined,
    };
  }
  if (Array.isArray(o['@graph'])) {
    for (const item of o['@graph']) {
      const p = walkLdProduct(item);
      if (p && (p.name || p.description || p.image)) return p;
    }
  }
  return null;
}

function extractFromLdJson(html: string, baseHref: string): ProductLd | null {
  for (const block of extractJsonLdBlocks(html)) {
    const p = walkLdProduct(block);
    if (p) {
      if (p.image) {
        const abs = absolutize(p.image, baseHref);
        return { ...p, image: abs ?? undefined };
      }
      return p;
    }
  }
  return null;
}

export type ProductScrapeSuccess = {
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  price: string | null;
  url: string;
};

export type ProductScrapeFailure = { error: 'BLOCKED' | 'EMPTY' | 'TIMEOUT' };

export type ProductScrapeResponse = ProductScrapeSuccess | ProductScrapeFailure;

export async function scrapeProductPage(inputUrl: string): Promise<ProductScrapeResponse> {
  const normalized = normalizeUrl(inputUrl);
  if (!normalized) return { error: 'EMPTY' };

  let html = '';
  try {
    const attempts = [normalized];
    const u = new URL(normalized);
    if (!u.hostname.startsWith('www.')) {
      const ww = new URL(normalized);
      ww.hostname = `www.${ww.hostname}`;
      attempts.push(ww.href);
    }
    let finalUrl = normalized;
    for (const target of attempts) {
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const r = await fetch(target, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; QuickpostBot/1.0; +https://quickpost.app)',
            Accept: 'text/html,application/xhtml+xml',
          },
          redirect: 'follow',
        });
        clearTimeout(to);
        if ([403, 429, 503].includes(r.status)) {
          return { error: 'BLOCKED' };
        }
        if (!r.ok) {
          continue;
        }
        const ct = r.headers.get('content-type') || '';
        if (ct && !ct.includes('text/html') && !ct.includes('application/xhtml')) {
          continue;
        }
        const text = await r.text();
        html = text.slice(0, HTML_MAX);
        finalUrl = r.url || target;
        break;
      } catch (e: unknown) {
        const name = e instanceof Error ? e.name : '';
        if (name === 'AbortError') {
          return { error: 'TIMEOUT' };
        }
        continue;
      }
    }
    if (!html) {
      return { error: 'EMPTY' };
    }

    const ld = extractFromLdJson(html, finalUrl);
    const ogSite = metaByProperty(html, 'og:site_name');
    const ogTitle = metaByProperty(html, 'og:title');
    const ogDesc = metaByProperty(html, 'og:description');
    const metaDesc = metaByName(html, 'description');
    const h1 = extractH1(html);
    const title = extractTitle(html);

    let name: string | null =
      (ld?.name && ld.name.trim()) ||
      (ogSite && ogSite.trim()) ||
      (ogTitle && ogTitle.trim()) ||
      (h1 && h1.trim()) ||
      (title && title.trim()) ||
      null;

    let description: string | null =
      (ld?.description && ld.description.trim()) ||
      (ogDesc && ogDesc.trim()) ||
      (metaDesc && metaDesc.trim()) ||
      firstLongParagraph(html) ||
      null;

    let imageUrl: string | null = ld?.image ?? extractOgImage(html, finalUrl) ?? extractFirstImg(html, finalUrl);

    let price: string | null = null;
    if (ld?.price) {
      const p = ld.price.trim();
      price = PRICE_RE.test(p) ? p.match(PRICE_RE)?.[0] ?? p : p;
    }
    if (!price) {
      price = priceFromText(stripTags(html).slice(0, 50_000));
    }

    const hasAny = !!(name?.trim() || description?.trim() || imageUrl?.trim());
    if (!hasAny) {
      return { error: 'EMPTY' };
    }

    return {
      name: name?.trim() || null,
      description: description?.trim() || null,
      imageUrl: imageUrl?.trim() || null,
      price: price?.trim() || null,
      url: finalUrl,
    };
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'AbortError') return { error: 'TIMEOUT' };
    return { error: 'EMPTY' };
  }
}
