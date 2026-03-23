import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

const MAX_BYTES = 10 * 1024 * 1024;

/** After JSON body parse: ensure optional base64 `photo` is a real image (not executable). */
export async function validateImagePayload(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const photo = req.body?.photo as string | undefined;
    if (!photo) {
      next();
      return;
    }
    let buf: Buffer;
    try {
      buf = Buffer.from(photo, 'base64');
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
