/**
 * Fetch public HTML and infer brand DNA via OpenAI (structured JSON).
 */
import { config } from '../config';

export type WebsiteScanAiResult = {
  brandSummary: string;
  suggestedVibe: 'professional' | 'bold' | 'warm';
  suggestedColor: string;
  suggestedColors: string[];
  businessType: 'restaurant' | 'salon' | 'retail' | 'gym' | 'cafe' | 'other';
  city: string | null;
  instagramHandle: string | null;
  tone: string;
};

export type WebsiteScanResult = WebsiteScanAiResult;

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

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1]?.trim() || '';
}

function extractMetaDescription(html: string): string {
  const m = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i
  );
  if (m?.[1]) return m[1].trim();
  const m2 = html.match(
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i
  );
  return m2?.[1]?.trim() || '';
}

function extractOgDescription(html: string): string {
  const m = html.match(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i
  );
  if (m?.[1]) return m[1].trim();
  const m2 = html.match(
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["'][^>]*>/i
  );
  return m2?.[1]?.trim() || '';
}

function extractH1(html: string): string {
  const m = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  return m?.[1]?.replace(/<[^>]+>/g, '')?.trim() || '';
}

function extractHexColors(html: string): string[] {
  const found = new Set<string>();
  const re = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  let m: RegExpExecArray | null;
  const s = html.slice(0, 500_000);
  while ((m = re.exec(s)) !== null) {
    let h = m[0];
    if (h.length === 4) {
      const r = h[1];
      const g = h[2];
      const b = h[3];
      h = `#${r}${r}${g}${g}${b}${b}`;
    }
    found.add(h.toLowerCase());
    if (found.size >= 12) break;
  }
  return [...found];
}

function inferBusinessType(text: string): WebsiteScanAiResult['businessType'] {
  const t = text.toLowerCase();
  if (/(menu|chef|dine|restaurant|food)/.test(t)) return 'restaurant';
  if (/(salon|spa|hair|beauty|nail|grooming)/.test(t)) return 'salon';
  if (/(retail|shop|store|boutique|product|catalog)/.test(t)) return 'retail';
  if (/(gym|fitness|workout|trainer|strength)/.test(t)) return 'gym';
  if (/(cafe|coffee|espresso|latte|barista)/.test(t)) return 'cafe';
  return 'other';
}

function inferVibe(text: string): WebsiteScanAiResult['suggestedVibe'] {
  const t = text.toLowerCase();
  if (/(premium|expert|trusted|professional|certified)/.test(t)) return 'professional';
  if (/(limited|sale|hurry|bold|exclusive|drop)/.test(t)) return 'bold';
  return 'warm';
}

function heuristicResult(params: {
  title: string;
  metaDescription: string;
  bodyText: string;
  hexFromPage: string[];
}): WebsiteScanResult {
  const merged = [params.title, params.metaDescription, params.bodyText]
    .filter(Boolean)
    .join('. ')
    .trim();
  const bt = inferBusinessType(merged);
  const vibe = inferVibe(merged);
  const suggestedColor = params.hexFromPage[0] || '#2A9D8F';
  return {
    brandSummary:
      (params.metaDescription || merged || 'Local business serving the community.').slice(0, 180),
    suggestedVibe: vibe,
    suggestedColor,
    suggestedColors: params.hexFromPage.slice(0, 3).length
      ? params.hexFromPage.slice(0, 3)
      : [suggestedColor],
    businessType: bt,
    city: null,
    instagramHandle: null,
    tone: vibe === 'professional' ? 'Clear and polished.' : vibe === 'bold' ? 'Energetic and direct.' : 'Friendly and welcoming.',
  };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mapAiRow(row: Record<string, unknown>): WebsiteScanAiResult | null {
  const brandSummary = typeof row.brandSummary === 'string' ? row.brandSummary.trim() : '';
  const suggestedVibeRaw = typeof row.suggestedVibe === 'string' ? row.suggestedVibe.toLowerCase().trim() : '';
  const suggestedVibe =
    suggestedVibeRaw === 'professional' || suggestedVibeRaw === 'bold' || suggestedVibeRaw === 'warm'
      ? suggestedVibeRaw
      : 'warm';
  const suggestedColor =
    typeof row.suggestedColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(row.suggestedColor.trim())
      ? row.suggestedColor.trim()
      : '#2A9D8F';
  const suggestedColors = Array.isArray(row.suggestedColors)
    ? row.suggestedColors
        .filter((c): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c.trim()))
        .map((c) => c.trim())
        .slice(0, 8)
    : [];
  const btRaw = typeof row.businessType === 'string' ? row.businessType.toLowerCase().trim() : 'other';
  const businessType =
    btRaw === 'restaurant' ||
    btRaw === 'salon' ||
    btRaw === 'retail' ||
    btRaw === 'gym' ||
    btRaw === 'cafe' ||
    btRaw === 'other'
      ? btRaw
      : 'other';
  const city = row.city === null ? null : typeof row.city === 'string' ? row.city.trim() || null : null;
  const ig =
    row.instagramHandle === null
      ? null
      : typeof row.instagramHandle === 'string'
        ? row.instagramHandle.trim() || null
        : null;
  const tone = typeof row.tone === 'string' ? row.tone.trim() : '';
  if (!brandSummary) return null;
  return {
    brandSummary,
    suggestedVibe,
    suggestedColor,
    suggestedColors: suggestedColors.length ? suggestedColors : [suggestedColor],
    businessType,
    city,
    instagramHandle: ig,
    tone: tone || 'Friendly and clear.',
  };
}

export async function scrapeAndAnalyzeWebsite(url: string): Promise<WebsiteScanResult | null> {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;

  let html = '';
  try {
    const attempts = [normalized];
    const u = new URL(normalized);
    if (!u.hostname.startsWith('www.')) {
      const ww = new URL(normalized);
      ww.hostname = `www.${ww.hostname}`;
      attempts.push(ww.href);
    }
    let fetched = false;
    for (const target of attempts) {
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(target, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; QuickpostBot/1.0; +https://quickpost.app)',
            Accept: 'text/html,application/xhtml+xml',
          },
          redirect: 'follow',
        });
        clearTimeout(to);
        if (!res.ok) continue;
        const ct = res.headers.get('content-type') || '';
        if (ct && !ct.includes('text/html') && !ct.includes('application/xhtml')) {
          continue;
        }
        const text = await res.text();
        html = text.slice(0, 2_000_000);
        fetched = true;
        break;
      } catch {
        continue;
      }
    }
    if (!fetched) return null;
  } catch (e) {
    console.warn('[website-scan] fetch failed', e);
    return null;
  }

  const title = extractTitle(html);
  const metaDescription = extractMetaDescription(html) || extractOgDescription(html);
  const bodyText = stripTags(html).slice(0, 500);
  const hexFromPage = extractHexColors(html);
  const h1 = extractH1(html);

  if (!config.openaiApiKey) {
    return heuristicResult({ title, metaDescription, bodyText, hexFromPage });
  }

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: 45_000 });
    const userPrompt = `Analyze this business website content and return ONLY valid JSON, no other text:
{
  "brandSummary": "one sentence describing this business",
  "suggestedVibe": "professional" OR "bold" OR "warm",
  "suggestedColor": "#hexcode of most fitting brand color",
  "suggestedColors": ["#hex1", "#hex2", "#hex3"],
  "businessType": "restaurant/salon/retail/gym/cafe/other",
  "city": "city name if found or null",
  "instagramHandle": "@handle if found or null",
  "tone": "brief description of their communication style"
}

Website title: ${title}
Meta description: ${metaDescription}
H1: ${h1}
Hex colors spotted in HTML (hints): ${hexFromPage.slice(0, 8).join(', ') || 'none'}
Body text: ${bodyText}`;

    const response = await client.chat.completions.create({
      model: config.openaiCaptionModel,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You extract brand DNA from website snippets. Output only valid JSON matching the user schema.',
        },
        { role: 'user', content: userPrompt },
      ],
    });
    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = extractJsonObject(raw);
    }
    if (!parsed) {
      return heuristicResult({ title, metaDescription, bodyText, hexFromPage });
    }
    return mapAiRow(parsed) || heuristicResult({ title, metaDescription, bodyText, hexFromPage });
  } catch (e) {
    console.warn('[website-scan] ai analyze failed', e);
    return heuristicResult({ title, metaDescription, bodyText, hexFromPage });
  }
}
