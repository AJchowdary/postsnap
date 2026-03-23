/**
 * Meta OAuth (Facebook + Instagram Business). Tokens stored server-side only, encrypted.
 * Never log access tokens.
 */
import jwt from 'jsonwebtoken';
import { getDb } from '../db';
import { requireAccountForUser } from './accountService';
import { config } from '../config';
import { encrypt, decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';
import { ReconnectRequiredError } from '../utils/errors';

export const META_ERROR_CODES = {
  NOT_PRO_ACCOUNT: 'NOT_PRO_ACCOUNT',
  NOT_PAGE_LINKED: 'NOT_PAGE_LINKED',
  MISSING_SCOPES: 'MISSING_SCOPES',
  TOKEN_EXCHANGE_FAILED: 'TOKEN_EXCHANGE_FAILED',
  PAGES_FETCH_FAILED: 'PAGES_FETCH_FAILED',
  IG_LOOKUP_FAILED: 'IG_LOOKUP_FAILED',
  INVALID_STATE: 'INVALID_STATE',
} as const;

const STATE_EXPIRY_SEC = 600; // 10 min
const GRAPH_BASE = 'https://graph.facebook.com';

export interface MetaStatePayload {
  sub: string;   // userId
  accountId: string;
  platform: 'facebook' | 'instagram';
  exp: number;
  iat: number;
}

function signState(payload: Omit<MetaStatePayload, 'exp' | 'iat'>): string {
  const secret = config.metaAppSecret;
  if (!secret) throw new Error('META_APP_SECRET is not set');
  return jwt.sign(
    { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + STATE_EXPIRY_SEC },
    secret,
    { algorithm: 'HS256' }
  );
}

function verifyState(state: string): MetaStatePayload {
  const secret = config.metaAppSecret;
  if (!secret) throw new Error('META_APP_SECRET is not set');
  const decoded = jwt.verify(state, secret, { algorithms: ['HS256'] }) as MetaStatePayload;
  if (!decoded.sub || !decoded.accountId || !decoded.platform) throw new Error('Invalid state payload');
  return decoded;
}

/** Build Meta OAuth authorization URL with signed state. */
export async function getMetaLoginUrl(
  ownerUserId: string,
  platform: 'facebook' | 'instagram'
): Promise<{ url: string; state: string }> {
  const accountId = await requireAccountForUser(ownerUserId);
  if (!config.metaAppId || !config.metaRedirectUri) {
    throw new Error('Meta OAuth not configured (META_APP_ID, META_REDIRECT_URI).');
  }
  const state = signState({ sub: ownerUserId, accountId, platform });
  const scope = config.metaOauthScopes.join(',');
  const versionSegment = config.metaGraphVersion.startsWith('v')
    ? config.metaGraphVersion
    : `v${config.metaGraphVersion}`;
  const url =
    `https://www.facebook.com/${versionSegment}/dialog/oauth` +
    `?client_id=${encodeURIComponent(config.metaAppId)}` +
    `&redirect_uri=${encodeURIComponent(config.metaRedirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code`;
  return { url, state };
}

async function exchangeCodeForToken(code: string): Promise<{ access_token: string; expires_in?: number }> {
  const res = await fetch(
    `${GRAPH_BASE}/${config.metaGraphVersion}/oauth/access_token` +
      `?client_id=${config.metaAppId}` +
      `&client_secret=${config.metaAppSecret}` +
      `&redirect_uri=${encodeURIComponent(config.metaRedirectUri!)}` +
      `&code=${encodeURIComponent(code)}`,
    { method: 'GET' }
  );
  if (!res.ok) {
    const text = await res.text();
    logger.warn('Meta token exchange failed', { status: res.status, body: text.slice(0, 200) });
    throw new Error(META_ERROR_CODES.TOKEN_EXCHANGE_FAILED);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error(META_ERROR_CODES.TOKEN_EXCHANGE_FAILED);
  return { access_token: data.access_token, expires_in: data.expires_in };
}

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = `${GRAPH_BASE}/${config.metaGraphVersion}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    const errMsg = (data as { error?: { message?: string } }).error?.message ?? res.statusText;
    logger.warn('Meta Graph API error', { path: path.slice(0, 80), status: res.status, message: errMsg });
    throw new Error(errMsg);
  }
  return data as T;
}

/** When true, redirect to API-hosted oauth pages (for localhost/dev when app URL not reachable). */
function useApiOAuthFallback(): boolean {
  const url = (config.publicAppUrl || '').replace(/\/$/, '');
  return !url || url.includes('localhost') || url.includes('127.0.0.1');
}

/** Build success/error redirect base. If localhost or no PUBLIC_APP_URL, use API base. */
export function getOAuthRedirectBase(apiBaseUrl?: string): { successBase: string; errorBase: string } {
  const appUrl = (config.publicAppUrl || '').replace(/\/$/, '');
  const useFallback = useApiOAuthFallback() && apiBaseUrl;
  const base = useFallback ? apiBaseUrl.replace(/\/$/, '') : appUrl;
  const successPath = useFallback ? '/api/v1/social/oauth/success' : '/oauth/success';
  const errorPath = useFallback ? '/api/v1/social/oauth/error' : '/oauth/error';
  return { successBase: base + successPath, errorBase: base + errorPath };
}

/** Handle callback: validate state, exchange code, fetch page + IG, persist. Returns redirect URL. */
export async function handleMetaCallback(
  state: string | null,
  code: string | null,
  errorFromMeta: string | null,
  apiBaseUrl?: string
): Promise<{ redirect: string; errorCode?: string }> {
  const { successBase: successUrl, errorBase: errorUrl } = getOAuthRedirectBase(apiBaseUrl);

  if (errorFromMeta) {
    logger.warn('Meta OAuth callback: error from Meta', { reason: errorFromMeta });
    const reason = encodeURIComponent(errorFromMeta);
    return { redirect: `${errorUrl}?reason=${reason}` };
  }
  if (!state || !code) {
    logger.warn('Meta OAuth callback: missing state or code');
    return { redirect: `${errorUrl}?reason=missing_state_or_code`, errorCode: META_ERROR_CODES.INVALID_STATE };
  }

  let payload: MetaStatePayload;
  try {
    payload = verifyState(state);
  } catch {
    logger.warn('Meta OAuth callback: invalid state');
    return { redirect: `${errorUrl}?reason=invalid_state`, errorCode: META_ERROR_CODES.INVALID_STATE };
  }

  const { accountId, platform } = payload;
  const db = await getDb();

  try {
    const { access_token, expires_in } = await exchangeCodeForToken(code);
    const expiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    // Fetch user's Facebook Pages
    const pagesData = await graphGet<{ data?: Array<{ id: string; name: string; access_token: string }> }>(
      '/me/accounts?fields=id,name,access_token',
      access_token
    ).catch(() => {
      throw new Error(META_ERROR_CODES.PAGES_FETCH_FAILED);
    });

    const pages = pagesData.data ?? [];
    if (pages.length === 0) {
      logger.warn('Meta OAuth callback: no pages', { accountId, errorCode: META_ERROR_CODES.PAGES_FETCH_FAILED });
      return {
        redirect: `${errorUrl}?reason=no_pages`,
        errorCode: META_ERROR_CODES.PAGES_FETCH_FAILED,
      };
    }

    // v1: use first page
    const page = pages[0];
    const pageAccessToken = page.access_token; // Page token for posting

    // Fetch IG Business account linked to this page
    const pageFields = await graphGet<{ instagram_business_account?: { id: string } }>(
      `/${page.id}?fields=instagram_business_account`,
      pageAccessToken
    ).catch(() => {
      throw new Error(META_ERROR_CODES.IG_LOOKUP_FAILED);
    });

    const igAccount = pageFields.instagram_business_account;
    if (!igAccount?.id) {
      logger.warn('Meta OAuth callback: IG not linked to page', {
        accountId,
        pageId: page.id,
        errorCode: META_ERROR_CODES.NOT_PAGE_LINKED,
      });
      return {
        redirect: `${errorUrl}?reason=instagram_not_linked`,
        errorCode: META_ERROR_CODES.NOT_PAGE_LINKED,
      };
    }

    let igUsername = '';
    try {
      const igInfo = await graphGet<{ username?: string }>(
        `/${igAccount.id}?fields=username`,
        pageAccessToken
      );
      igUsername = igInfo.username ?? '';
    } catch {
      // non-fatal
    }

    const scopes = config.metaOauthScopes;
    const encryptedToken = config.tokenEncryptionKey ? encrypt(pageAccessToken) : null;
    if (!encryptedToken && config.tokenEncryptionKey === '') {
      logger.warn('Meta: TOKEN_ENCRYPTION_KEY not set; token not stored.');
    }

    const now = new Date().toISOString();

    // Upsert Facebook connection (page + token)
    await db.upsertOne(
      'social_connections',
      { account_id: accountId, platform: 'facebook' },
      {
        account_id: accountId,
        platform: 'facebook',
        handle_or_page: page.name,
        access_token_encrypted: encryptedToken,
        token_expires_at: expiresAt,
        status: 'connected',
        meta_page_id: page.id,
        meta_page_name: page.name,
        granted_scopes: scopes,
        updated_at: now,
      }
    );

    // Upsert Instagram connection (IG business id + username; same token used for IG API)
    await db.upsertOne(
      'social_connections',
      { account_id: accountId, platform: 'instagram' },
      {
        account_id: accountId,
        platform: 'instagram',
        handle_or_page: igUsername || igAccount.id,
        access_token_encrypted: encryptedToken,
        token_expires_at: expiresAt,
        status: 'connected',
        ig_business_id: igAccount.id,
        ig_username: igUsername,
        granted_scopes: scopes,
        updated_at: now,
      }
    );

    logger.info('Meta OAuth callback: success', { accountId, platform: payload.platform, pageId: page.id, igBusinessId: igAccount.id });
    return { redirect: `${successUrl}?platform=instagram` };
  } catch (err: any) {
    const code =
      err.message === META_ERROR_CODES.TOKEN_EXCHANGE_FAILED ||
      err.message === META_ERROR_CODES.PAGES_FETCH_FAILED ||
      err.message === META_ERROR_CODES.IG_LOOKUP_FAILED ||
      err.message === META_ERROR_CODES.NOT_PAGE_LINKED
        ? err.message
        : META_ERROR_CODES.TOKEN_EXCHANGE_FAILED;
    logger.warn('Meta OAuth callback error', {
      errorCode: code,
      reason: err.message?.slice(0, 100),
    });
    const reason = encodeURIComponent(err.message || 'callback_failed');
    return {
      redirect: `${errorUrl}?reason=${reason}&code=${encodeURIComponent(code)}`,
      errorCode: code,
    };
  }
}

export interface SocialConnectionMeta {
  status: string;
  /** True when status is expired or revoked; UI should show "Reconnect required". */
  reconnectRequired?: boolean;
  pageName?: string | null;
  pageId?: string | null;
  expiresAt?: string | null;
  username?: string | null;
  igBusinessId?: string | null;
}

export interface ConnectionsResponse {
  facebook: SocialConnectionMeta | null;
  instagram: SocialConnectionMeta | null;
}

/** Get connection status for both platforms (no tokens). */
export async function getMetaConnections(ownerUserId: string): Promise<ConnectionsResponse> {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const rows = await db.findMany<{
    platform: string;
    status: string;
    metaPageName?: string | null;
    metaPageId?: string | null;
    igUsername?: string | null;
    igBusinessId?: string | null;
    tokenExpiresAt?: string | null;
  }>('social_connections', { account_id: accountId });

  const fb = rows.find((r) => r.platform === 'facebook');
  const ig = rows.find((r) => r.platform === 'instagram');

  const fbStatus = fb ? ensureValidMetaToken(fb) : null;
  const igStatus = ig ? ensureValidMetaToken(ig) : null;

  return {
    facebook: fb
      ? {
          status: fbStatus!,
          reconnectRequired: fbStatus === 'expired' || fbStatus === 'revoked',
          pageName: fb.metaPageName ?? null,
          pageId: fb.metaPageId ?? null,
          expiresAt: fb.tokenExpiresAt ?? null,
          username: null,
          igBusinessId: null,
        }
      : null,
    instagram: ig
      ? {
          status: igStatus!,
          reconnectRequired: igStatus === 'expired' || igStatus === 'revoked',
          pageName: null,
          pageId: null,
          expiresAt: ig.tokenExpiresAt ?? null,
          username: ig.igUsername ?? null,
          igBusinessId: ig.igBusinessId ?? null,
        }
      : null,
  };
}

/** If token is expired, return 'expired'; else return stored status. */
export function ensureValidMetaToken(connection: {
  status: string;
  tokenExpiresAt?: string | null;
}): string {
  if (connection.status === 'disconnected' || connection.status === 'revoked') return connection.status;
  const expiresAt = connection.tokenExpiresAt;
  if (expiresAt && new Date(expiresAt) <= new Date()) return 'expired';
  return connection.status;
}

export interface MetaDiagnostics {
  metaRedirectUri: string;
  allowedRedirectUrisChecklist: string;
  connections: { facebook: string | null; instagram: string | null };
  envPresent: { metaAppId: boolean; metaAppSecret: boolean; metaRedirectUri: boolean; tokenEncryptionKey: boolean };
  warnings: string[];
}

/** Meta OAuth readiness diagnostics. No secrets. Auth caller only. */
export async function getMetaDiagnostics(ownerUserId: string): Promise<MetaDiagnostics> {
  const connections = await getMetaConnections(ownerUserId);
  const metaRedirectUri = config.metaRedirectUri || '(not set)';
  const allowedRedirectUrisChecklist =
    'In Meta App: Facebook Login → Settings → Valid OAuth Redirect URIs must include exactly: ' + metaRedirectUri;
  const warnings: string[] = [];
  if (!config.metaGraphVersion.startsWith('v')) {
    warnings.push("META_GRAPH_VERSION should start with 'v' (e.g. v20.0)");
  }
  const requiredScopes = ['pages_show_list', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish'];
  const missing = requiredScopes.filter((s) => !config.metaOauthScopes.includes(s));
  if (missing.length) {
    warnings.push('META_OAUTH_SCOPES may be missing: ' + missing.join(', '));
  }
  if (!config.metaRedirectUri) {
    warnings.push('META_REDIRECT_URI is not set');
  }
  return {
    metaRedirectUri,
    allowedRedirectUrisChecklist,
    connections: {
      facebook: connections.facebook?.status ?? null,
      instagram: connections.instagram?.status ?? null,
    },
    envPresent: {
      metaAppId: !!config.metaAppId,
      metaAppSecret: !!config.metaAppSecret,
      metaRedirectUri: !!config.metaRedirectUri,
      tokenEncryptionKey: !!config.tokenEncryptionKey && config.tokenEncryptionKey.length >= 32,
    },
    warnings,
  };
}

const FB_SCOPES_PUBLISH = ['pages_manage_posts', 'pages_show_list'];
const IG_SCOPES_PUBLISH = ['instagram_content_publish', 'instagram_basic'];

export interface MetaConnectionForPublish {
  status: string;
  tokenExpiresAt: string | null;
  accessToken: string;
  metaPageId: string | null;
  metaPageName: string | null;
  igBusinessId: string | null;
  igUsername: string | null;
  grantedScopes: string[] | null;
}

/**
 * Get decrypted Meta connection for publishing. Validates status, expiry, IDs, scopes.
 * If invalid, updates connection to expired/revoked and throws ReconnectRequiredError.
 */
export async function getMetaConnectionOrThrow(
  ownerUserId: string,
  platform: 'facebook' | 'instagram'
): Promise<MetaConnectionForPublish> {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const conn = await db.findOne<{
    id: string;
    platform: string;
    status: string;
    tokenExpiresAt?: string | null;
    accessTokenEncrypted?: string | null;
    metaPageId?: string | null;
    metaPageName?: string | null;
    igBusinessId?: string | null;
    igUsername?: string | null;
    grantedScopes?: string[] | null;
  }>('social_connections', { account_id: accountId, platform });

  if (!conn) throw new ReconnectRequiredError('Not connected');
  if (conn.status === 'disconnected' || conn.status === 'revoked') {
    throw new ReconnectRequiredError('Reconnect required');
  }
  if (conn.tokenExpiresAt && new Date(conn.tokenExpiresAt) <= new Date()) {
    await db.updateOne('social_connections', conn.id, {
      status: 'expired',
      updated_at: new Date().toISOString(),
    });
    throw new ReconnectRequiredError('Token expired');
  }
  if (platform === 'facebook') {
    if (!conn.metaPageId) throw new ReconnectRequiredError('Page not linked');
    const scopes = (conn.grantedScopes ?? []) as string[];
    if (!FB_SCOPES_PUBLISH.some((s) => scopes.includes(s))) {
      await db.updateOne('social_connections', conn.id, {
        status: 'revoked',
        updated_at: new Date().toISOString(),
      });
      throw new ReconnectRequiredError('Missing required scopes');
    }
  }
  if (platform === 'instagram') {
    if (!conn.igBusinessId) throw new ReconnectRequiredError('Instagram not linked');
    const scopes = (conn.grantedScopes ?? []) as string[];
    if (!IG_SCOPES_PUBLISH.every((s) => scopes.includes(s))) {
      await db.updateOne('social_connections', conn.id, {
        status: 'revoked',
        updated_at: new Date().toISOString(),
      });
      throw new ReconnectRequiredError('Missing required scopes');
    }
  }
  if (!conn.accessTokenEncrypted) throw new ReconnectRequiredError('No token');
  if (!config.tokenEncryptionKey) throw new ReconnectRequiredError('Token unavailable');
  let accessToken: string;
  try {
    accessToken = decrypt(conn.accessTokenEncrypted);
  } catch {
    await db.updateOne('social_connections', conn.id, {
      status: 'revoked',
      updated_at: new Date().toISOString(),
    });
    throw new ReconnectRequiredError('Invalid token');
  }
  return {
    status: conn.status,
    tokenExpiresAt: conn.tokenExpiresAt ?? null,
    accessToken,
    metaPageId: conn.metaPageId ?? null,
    metaPageName: conn.metaPageName ?? null,
    igBusinessId: conn.igBusinessId ?? null,
    igUsername: conn.igUsername ?? null,
    grantedScopes: (conn.grantedScopes as string[] | null) ?? null,
  };
}

/** Disconnect platform: clear token and ids, set status disconnected. */
export async function disconnectMeta(ownerUserId: string, platform: string): Promise<void> {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const conn = await db.findOne<{ id: string }>('social_connections', {
    account_id: accountId,
    platform,
  });
  if (!conn) return;
  await db.updateOne('social_connections', conn.id, {
    status: 'disconnected',
    access_token_encrypted: null,
    token_expires_at: null,
    meta_page_id: null,
    meta_page_name: null,
    ig_business_id: null,
    ig_username: null,
    granted_scopes: null,
    handle_or_page: '',
    updated_at: new Date().toISOString(),
  });
}
