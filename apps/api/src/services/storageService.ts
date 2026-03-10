import { getSupabase } from '../db/supabaseClient';
import { config } from '../config';

const BUCKET = config.storageBucket;
const UPLOAD_EXPIRY_SEC = 60 * 15;
const READ_EXPIRY_SEC = 60 * 60;

export function getUploadPath(accountId: string, postId: string, file = 'original'): string {
  const ext = file === 'original' ? 'jpg' : 'jpg';
  return `account/${accountId}/posts/${postId}/${file}.${ext}`;
}

export async function createSignedUploadUrl(
  accountId: string,
  postId: string
): Promise<{ path: string; url: string }> {
  const path = getUploadPath(accountId, postId, 'original');
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw new Error(`Storage signed upload: ${error.message}`);
  return { path, url: data.signedUrl };
}

export async function createSignedReadUrl(
  storagePath: string
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, READ_EXPIRY_SEC);
  if (error) throw new Error(`Storage signed read: ${error.message}`);
  return data.signedUrl;
}

/** Signed read URL with custom TTL (e.g. 30 min for Meta to fetch). Do NOT store in DB. */
export async function createSignedReadUrlWithTTL(
  storagePath: string,
  expiresInSec: number
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) throw new Error(`Storage signed read: ${error.message}`);
  return data.signedUrl;
}

export async function getProcessedPath(accountId: string, postId: string): Promise<string> {
  return getUploadPath(accountId, postId, 'processed');
}

/**
 * Upload processed image bytes to storage. Input: data URL (data:image/...;base64,...) or HTTP URL.
 * Returns storage path for the uploaded file.
 */
export async function uploadProcessedImage(
  accountId: string,
  postId: string,
  imageDataUrlOrUrl: string
): Promise<string> {
  const supabase = getSupabase();
  const path = getUploadPath(accountId, postId, 'processed');
  let buf: Buffer;
  if (imageDataUrlOrUrl.startsWith('data:')) {
    const base64 = imageDataUrlOrUrl.replace(/^data:image\/\w+;base64,/, '');
    buf = Buffer.from(base64, 'base64');
  } else if (imageDataUrlOrUrl.startsWith('http')) {
    const res = await fetch(imageDataUrlOrUrl);
    if (!res.ok) throw new Error(`Fetch image failed: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } else {
    throw new Error('Invalid image input: expected data URL or http(s) URL');
  }
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) throw new Error(`Storage upload: ${error.message}`);
  return path;
}
