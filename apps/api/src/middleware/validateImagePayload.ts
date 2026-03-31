import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

const MAX_BYTES = 10 * 1024 * 1024;

/** Raw base64 (Expo) or data URL — middleware must decode the same bytes the client uploaded. */
function rawBase64FromPhotoField(photo: string): string {
  const t = photo.trim();
  const m = t.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
  if (m) return m[2].replace(/\s/g, '');
  return t.replace(/\s/g, '');
}

/** After JSON body parse: ensure optional base64 `photo` is a real image (not executable). */
export async function validateImagePayload(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const photo = req.body?.photo as string | undefined;
    if (!photo) {
      next();
      return;
    }
    const rawB64 = rawBase64FromPhotoField(photo);
    let buf: Buffer;
    try {
      buf = Buffer.from(rawB64, 'base64');
    } catch {
      throw new ValidationError('Invalid image encoding');
    }
    if (buf.length > MAX_BYTES) {
      throw new ValidationError('Image exceeds 10MB');
    }
    const { fileTypeFromBuffer } = await import('file-type');
    const ft = await fileTypeFromBuffer(buf);
    if (!ft || !/^image\/(jpeg|png|webp|gif)$/.test(ft.mime)) {
      throw new ValidationError('Only JPEG, PNG, WebP, or GIF images are allowed');
    }
    next();
  } catch (e) {
    next(e);
  }
}
