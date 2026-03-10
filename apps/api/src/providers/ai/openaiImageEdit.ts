/**
 * OpenAI image edit via SDK: proper input handling (bytes/URL, optional mask),
 * strict timeout, and retry classification (rate limit / transient / permanent).
 */
import OpenAI, { toFile } from 'openai';
import type { Uploadable } from 'openai/uploads';
import { config } from '../../config';
import { classifyRetry, retryDelayMs } from './openaiRetry';
import { logger } from '../../utils/logger';

const IMAGE_EDIT_TIMEOUT_MS = config.openaiImageEditTimeoutMs;
const MAX_RETRIES = config.openaiImageEditMaxRetries;

export type ImageEditInput =
  | { type: 'base64'; data: string; mime?: string }
  | { type: 'url'; url: string }
  | { type: 'bytes'; data: Uint8Array | Buffer; mime?: string };

export type MaskInput =
  | { type: 'base64'; data: string }
  | { type: 'url'; url: string }
  | { type: 'bytes'; data: Uint8Array | Buffer }
  | null;

function isHttpUrl(s: string): boolean {
  return s.startsWith('http://') || s.startsWith('https://');
}

/**
 * Convert image input to SDK Uploadable (File) for multipart.
 */
async function toUploadable(input: ImageEditInput): Promise<Uploadable> {
  if (input.type === 'base64') {
    const buf = Buffer.from(input.data, 'base64');
    const mime = input.mime ?? 'image/jpeg';
    const name = mime === 'image/png' ? 'image.png' : 'image.jpg';
    return toFile(buf, name, { type: mime });
  }
  if (input.type === 'bytes') {
    const mime = input.mime ?? 'image/jpeg';
    const name = mime === 'image/png' ? 'image.png' : 'image.jpg';
    return toFile(input.data, name, { type: mime });
  }
  if (input.type === 'url') {
    const res = await fetch(input.url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') ?? 'image/jpeg';
    const name = ct.includes('png') ? 'image.png' : 'image.jpg';
    return toFile(buf, name, { type: ct });
  }
  throw new Error('Invalid image input type');
}

/**
 * Convert optional mask to Uploadable (PNG).
 */
async function maskToUploadable(mask: MaskInput): Promise<Uploadable | undefined> {
  if (!mask) return undefined;
  if (mask.type === 'base64') {
    const buf = Buffer.from(mask.data, 'base64');
    return toFile(buf, 'mask.png', { type: 'image/png' });
  }
  if (mask.type === 'bytes') {
    return toFile(mask.data, 'mask.png', { type: 'image/png' });
  }
  if (mask.type === 'url') {
    const res = await fetch(mask.url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Mask fetch failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return toFile(buf, 'mask.png', { type: 'image/png' });
  }
  return undefined;
}

export interface ImageEditParams {
  image: ImageEditInput;
  mask?: MaskInput;
  prompt: string;
  model: string;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
}

/**
 * Call OpenAI images.edit with timeout and retries.
 * Returns first image as base64 data URL (gpt-image-1 returns b64_json) or null.
 */
export async function createImageEdit(params: ImageEditParams): Promise<string | null> {
  const client = new OpenAI({
    apiKey: config.openaiApiKey,
    timeout: IMAGE_EDIT_TIMEOUT_MS,
  });

  const imageFile = await toUploadable(params.image);
  const maskFile = params.mask ? await maskToUploadable(params.mask) : undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.images.edit({
        image: imageFile,
        mask: maskFile,
        prompt: params.prompt.slice(0, 32_000),
        model: params.model as 'gpt-image-1' | 'dall-e-2',
        size: params.size ?? '1024x1024',
        quality: (params.quality as 'low' | 'medium' | 'high' | 'auto') ?? 'auto',
        n: 1,
      }, {
        timeout: IMAGE_EDIT_TIMEOUT_MS,
        maxRetries: 0,
      });

      const first = response.data?.[0];
      if (!first) return null;
      if (first.b64_json) {
        const mime = 'image/png';
        return `data:${mime};base64,${first.b64_json}`;
      }
      if (first.url) return first.url;
      return null;
    } catch (err) {
      const kind = classifyRetry(err);
      if (kind === 'permanent' || attempt === MAX_RETRIES) {
        logger.warn('Image edit failed', { attempt: attempt + 1, kind, error: (err as Error).message });
        return null;
      }
      const delay = retryDelayMs(kind, attempt);
      logger.info('Image edit retry', { attempt: attempt + 1, kind, delayMs: delay });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

/**
 * Build ImageEditInput from provider params (photoBase64 or imagePath URL).
 */
export function buildImageInput(params: { photoBase64?: string; imagePath?: string }): ImageEditInput | null {
  if (params.photoBase64) {
    const raw = params.photoBase64.replace(/^data:image\/\w+;base64,/, '');
    return { type: 'base64', data: raw, mime: 'image/jpeg' };
  }
  if (params.imagePath && isHttpUrl(params.imagePath)) {
    return { type: 'url', url: params.imagePath };
  }
  if (params.imagePath) {
    return null;
  }
  return null;
}
