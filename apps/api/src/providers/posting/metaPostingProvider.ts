/**
 * Real Meta Graph API publishing: Facebook Page photo post + Instagram feed (container -> publish).
 * Never log access tokens. Use META_GRAPH_VERSION.
 */
import { config } from '../../config';

const GRAPH_BASE = 'https://graph.facebook.com';
const CAPTION_MAX_LEN = 2000; // Safe cap for FB/IG
const REQUEST_TIMEOUT_MS = 30_000;

function graphVersion(): string {
  return config.metaGraphVersion.startsWith('v')
    ? config.metaGraphVersion
    : `v${config.metaGraphVersion}`;
}

function graphUrl(path: string): string {
  return `${GRAPH_BASE}/${graphVersion()}${path}`;
}

/**
 * Classify Meta publish errors for retry. Only TRANSIENT errors should be retried.
 * Transient: network timeout, HTTP 429, HTTP 5xx.
 * Permanent: HTTP 400/403, OAuthException codes 10 (permission) or 190 (token expired/revoked).
 */
export function isTransientPublishError(
  status?: number,
  body?: { error?: { code?: number; error_subcode?: number } }
): boolean {
  if (status === undefined) return true; // e.g. timeout, no HTTP response
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  const code = body?.error?.code;
  if (code === 190 || code === 10) return false;
  if (status >= 400 && status < 500) return false;
  return false;
}

export interface FacebookPostInput {
  pageId: string;
  pageAccessToken: string;
  message: string;
  imageUrlOrPath: string; // Must be publicly accessible URL (e.g. signed)
}

export interface InstagramPostInput {
  igBusinessId: string;
  pageAccessToken: string;
  caption: string;
  imageUrlOrPath: string;
}

async function fetchGraph(
  url: string,
  method: 'GET' | 'POST',
  body?: Record<string, string>
): Promise<{ status: number; data: any }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      body: body ? new URLSearchParams(body).toString() : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      const ex = new Error('Request timeout') as Error & { status?: number; transient?: boolean; data?: any };
      ex.status = undefined;
      ex.transient = true;
      ex.data = undefined;
      throw ex;
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Post a photo to a Facebook Page.
 * Graph API: POST /{page_id}/photos with url, caption (message), published=true.
 * imageUrlOrPath must be a publicly accessible URL (e.g. signed Supabase URL).
 */
export async function postToFacebookPage(input: FacebookPostInput): Promise<{ platformPostId: string }> {
  const message = input.message.slice(0, CAPTION_MAX_LEN);
  const url = graphUrl(`/${input.pageId}/photos`);
  const body: Record<string, string> = {
    access_token: input.pageAccessToken,
    url: input.imageUrlOrPath,
    message,
    published: 'true',
  };
  const { status, data } = await fetchGraph(url, 'POST', body);
  const err = data?.error;
  if (status !== 200 || !data?.id) {
    const msg = err?.message ?? `HTTP ${status}`;
    const ex = new Error(msg) as Error & { status?: number; code?: number; transient?: boolean; data?: any };
    ex.status = status;
    ex.code = err?.code;
    ex.transient = isTransientPublishError(status, data);
    ex.data = data;
    throw ex;
  }
  return { platformPostId: data.id };
}

/**
 * Instagram feed post: create container (image_url + caption) then publish.
 */
export async function postToInstagram(input: InstagramPostInput): Promise<{ platformPostId: string }> {
  const caption = input.caption.slice(0, CAPTION_MAX_LEN);
  const createUrl = graphUrl(`/${input.igBusinessId}/media`);
  const createBody: Record<string, string> = {
    access_token: input.pageAccessToken,
    image_url: input.imageUrlOrPath,
    caption,
  };
  const createRes = await fetchGraph(createUrl, 'POST', createBody);
  const createErr = createRes.data?.error;
  if (createRes.status !== 200 || !createRes.data?.id) {
    const msg = createErr?.message ?? `Instagram container HTTP ${createRes.status}`;
    const ex = new Error(msg) as Error & { status?: number; code?: number; transient?: boolean; data?: any };
    ex.status = createRes.status;
    ex.code = createErr?.code;
    ex.transient = isTransientPublishError(createRes.status, createRes.data);
    ex.data = createRes.data;
    throw ex;
  }
  const creationId = createRes.data.id;

  const publishUrl = graphUrl(`/${input.igBusinessId}/media_publish`);
  const publishBody: Record<string, string> = {
    access_token: input.pageAccessToken,
    creation_id: creationId,
  };
  const publishRes = await fetchGraph(publishUrl, 'POST', publishBody);
  const publishErr = publishRes.data?.error;
  if (publishRes.status !== 200 || !publishRes.data?.id) {
    const msg = publishErr?.message ?? `Instagram publish HTTP ${publishRes.status}`;
    const ex = new Error(msg) as Error & { status?: number; code?: number; transient?: boolean; data?: any };
    ex.status = publishRes.status;
    ex.code = publishErr?.code;
    ex.transient = isTransientPublishError(publishRes.status, publishRes.data);
    ex.data = publishRes.data;
    throw ex;
  }
  return { platformPostId: publishRes.data.id };
}
