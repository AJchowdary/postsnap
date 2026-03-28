/**
 * Multi-format JPEG exports for Instagram / Facebook (smart-crop via sharp attention).
 */
import sharp from 'sharp';
import { getDb } from '../db';
import { logger } from '../utils/logger';
import {
  downloadStorageObject,
  getExportAssetStoragePath,
  uploadStorageObject,
} from './storageService';

export type PostExportAssets = {
  instagram?: { '1_1'?: string; '4_5'?: string };
  facebook?: { '16_9'?: string; '1_1'?: string };
};

const EXPORT_SPECS = [
  { platform: 'instagram' as const, key: '1_1' as const, w: 1080, h: 1080, file: 'ig_1080_1080' },
  { platform: 'instagram' as const, key: '4_5' as const, w: 1080, h: 1350, file: 'ig_1080_1350' },
  { platform: 'facebook' as const, key: '16_9' as const, w: 1200, h: 628, file: 'fb_1200_628' },
  { platform: 'facebook' as const, key: '1_1' as const, w: 1080, h: 1080, file: 'fb_1080_1080' },
];

async function cropExport(master: Buffer, w: number, h: number): Promise<Buffer> {
  return sharp(master)
    .rotate()
    .resize(w, h, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

export async function generateAndUploadPostExportAssets(
  accountId: string,
  postId: string,
  master: Buffer
): Promise<PostExportAssets | null> {
  const out: PostExportAssets = {};
  for (const spec of EXPORT_SPECS) {
    try {
      const jpeg = await cropExport(master, spec.w, spec.h);
      const path = getExportAssetStoragePath(accountId, postId, spec.file);
      await uploadStorageObject(path, jpeg, 'image/jpeg');
      if (spec.platform === 'instagram') {
        out.instagram = { ...out.instagram, [spec.key]: path };
      } else {
        out.facebook = { ...out.facebook, [spec.key]: path };
      }
    } catch (e) {
      logger.warn('Export asset failed', {
        postId,
        slot: spec.file,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  const hasAny =
    (out.instagram && Object.keys(out.instagram).length > 0) ||
    (out.facebook && Object.keys(out.facebook).length > 0);
  return hasAny ? out : null;
}

function exportAssetsComplete(ex?: PostExportAssets | null): boolean {
  if (!ex?.instagram || !ex.facebook) return false;
  return !!(
    ex.instagram['1_1'] &&
    ex.instagram['4_5'] &&
    ex.facebook['16_9'] &&
    ex.facebook['1_1']
  );
}

/** Pick storage path for Meta fetch: IG prefers 4:5, Facebook prefers 16:9, then fallbacks. */
export function getPublishStoragePathForPlatform(
  post: {
    exportAssets?: PostExportAssets | null;
    processedImagePath?: string | null;
    originalImagePath?: string | null;
  },
  platform: 'instagram' | 'facebook'
): string | null {
  const ex = post.exportAssets;
  if (platform === 'instagram') {
    return (
      ex?.instagram?.['4_5'] ??
      ex?.instagram?.['1_1'] ??
      post.processedImagePath ??
      post.originalImagePath ??
      null
    );
  }
  return (
    ex?.facebook?.['16_9'] ??
    ex?.facebook?.['1_1'] ??
    post.processedImagePath ??
    post.originalImagePath ??
    null
  );
}

export async function ensurePostExportAssetsIfNeeded(
  post: {
    id: string;
    exportAssets?: PostExportAssets | null;
    processedImagePath?: string | null;
  },
  accountId: string
): Promise<PostExportAssets | null> {
  if (!post.processedImagePath) return post.exportAssets ?? null;
  if (exportAssetsComplete(post.exportAssets)) return post.exportAssets ?? null;

  try {
    const buf = await downloadStorageObject(post.processedImagePath);
    const assets = await generateAndUploadPostExportAssets(accountId, post.id, buf);
    if (assets) {
      const db = await getDb();
      await db.updateOne('posts', post.id, {
        export_assets: assets,
        updated_at: new Date().toISOString(),
      });
    }
    return assets ?? post.exportAssets ?? null;
  } catch (e) {
    logger.warn('ensurePostExportAssetsIfNeeded failed', {
      postId: post.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return post.exportAssets ?? null;
  }
}
