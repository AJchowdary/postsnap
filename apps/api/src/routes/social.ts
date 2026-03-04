import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ConnectSocialSchema } from '../schemas/account';
import { getSocialAccounts, connectSocial, disconnectSocial } from '../services/socialService';
import {
  getMetaLoginUrl,
  handleMetaCallback,
  getMetaConnections,
  disconnectMeta,
  getMetaDiagnostics,
} from '../services/metaOAuthService';
import { asyncHandler } from '../utils/asyncHandler';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNextStepsForReason(reason: string, code: string): string[] {
  const steps: string[] = [];
  if (reason.includes('redirect') || reason.includes('uri') || code === 'redirect_uri_mismatch') {
    steps.push('In Meta App: Facebook Login → Settings → add this exact Valid OAuth Redirect URI.');
    steps.push('Ensure API_PUBLIC_URL / META_REDIRECT_URI match the URL Meta redirects to (including path).');
  }
  if (reason.includes('no_pages') || code === 'PAGES_FETCH_FAILED') {
    steps.push('Ensure the Facebook account has at least one Page (create one at facebook.com/pages).');
    steps.push('Add yourself as a tester or admin of the Meta app if in development.');
  }
  if (reason.includes('instagram') || code === 'NOT_PAGE_LINKED') {
    steps.push('Convert the Instagram account to a Professional/Creator account and link it to a Facebook Page.');
    steps.push('In Meta Business Suite: connect the Page and Instagram account.');
  }
  if (reason.includes('state') || code === 'INVALID_STATE') {
    steps.push('Retry the connection from the app; do not reuse the same link after expiry.');
  }
  if (reason.includes('token') || code === 'TOKEN_EXCHANGE_FAILED') {
    steps.push('Check META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI in the API env.');
    steps.push('Ensure Web OAuth Login is enabled in Meta App → Facebook Login.');
  }
  if (steps.length === 0) {
    steps.push('Check API logs for the exact error code.');
    steps.push('Ensure Meta app is in Live mode or add test users for development.');
  }
  return steps;
}

const router = Router();

router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const accounts = await getSocialAccounts(req.userId!);
  res.json(accounts);
}));

router.post('/connect', authenticate, validate(ConnectSocialSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await connectSocial(req.userId!, req.body);
  res.json(result);
}));

router.delete('/disconnect/:platform', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await disconnectSocial(req.userId!, req.params['platform'] as string);
  res.json(result);
}));

// --- Meta OAuth (Step 4) ---
router.get('/meta/login-url', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const platform = (req.query.platform as string) || 'instagram';
  if (platform !== 'facebook' && platform !== 'instagram') {
    return res.status(400).json({ error: true, code: 'VALIDATION_ERROR', message: 'platform must be facebook or instagram' });
  }
  const { url } = await getMetaLoginUrl(req.userId!, platform);
  res.json({ url });
}));

router.get('/meta/callback', asyncHandler(async (req: AuthRequest, res: Response) => {
  const state = (req.query.state as string) || null;
  const code = (req.query.code as string) || null;
  const errorFromMeta = (req.query.error as string) || null;
  const apiBase = req.protocol + '://' + (req.get('host') || '');
  const { redirect, errorCode } = await handleMetaCallback(state, code, errorFromMeta, apiBase);
  res.redirect(302, redirect);
}));

/** Local OAuth success page (no auth). Shown when PUBLIC_APP_URL is localhost or unset. */
router.get('/oauth/success', (_req, res: Response) => {
  const platform = (typeof _req.query.platform === 'string' ? _req.query.platform : '') || 'facebook/instagram';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OAuth success</title></head><body style="font-family:sans-serif;max-width:480px;margin:2rem auto;padding:1rem;">
<h1>Connected</h1>
<p><strong>Platform:</strong> ${escapeHtml(platform)}</p>
<p><strong>Status:</strong> connected</p>
<p>You can close this tab and return to the app.</p>
<p><small>If the app did not update, pull to refresh or reopen the app.</small></p>
</body></html>`;
  res.setHeader('Content-Type', 'text/html').send(html);
});

/** Local OAuth error page (no auth). Shown when PUBLIC_APP_URL is localhost or unset. */
router.get('/oauth/error', (_req, res: Response) => {
  const reason = (typeof _req.query.reason === 'string' ? _req.query.reason : '') || 'unknown';
  const code = (typeof _req.query.code === 'string' ? _req.query.code : '') || '';
  const nextSteps = getNextStepsForReason(reason, code);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OAuth error</title></head><body style="font-family:sans-serif;max-width:560px;margin:2rem auto;padding:1rem;">
<h1>Connection failed</h1>
<p><strong>Status:</strong> failed</p>
<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
${code ? `<p><strong>Code:</strong> ${escapeHtml(code)}</p>` : ''}
<h2>Next steps</h2>
<ul>${nextSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
<p><small>No secrets or tokens are shown. Fix configuration and try again from the app.</small></p>
</body></html>`;
  res.setHeader('Content-Type', 'text/html').send(html);
});

router.get('/connections', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const connections = await getMetaConnections(req.userId!);
  res.json(connections);
}));

router.delete('/connections/:platform', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const platform = req.params.platform as string;
  if (platform !== 'facebook' && platform !== 'instagram') {
    return res.status(400).json({ error: true, code: 'VALIDATION_ERROR', message: 'platform must be facebook or instagram' });
  }
  await disconnectMeta(req.userId!, platform);
  res.json({ success: true });
}));

/** Meta OAuth readiness diagnostics (auth-protected). No secrets returned. */
router.get('/meta/diagnostics', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const diagnostics = await getMetaDiagnostics(req.userId!);
  res.json(diagnostics);
}));

export default router;
