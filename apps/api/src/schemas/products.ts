import { z } from 'zod';

function normalizeProductUrl(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return '';
  try {
    const u = new URL(s.startsWith('http://') || s.startsWith('https://') ? s : `https://${s}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.href;
  } catch {
    return '';
  }
}

export const ProductScrapeSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'URL is required')
    .transform((s) => normalizeProductUrl(s))
    .refine((s) => s.length > 0, 'Invalid URL'),
});

export type ProductScrapeInput = z.infer<typeof ProductScrapeSchema>;
