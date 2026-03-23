import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { TEMPLATES_BY_TYPE } from '../utils/templates';
import { sendSuccess, sendFail } from '../utils/apiResponse';

const router = Router();

router.use(authenticate);

router.get('/', (_req: Request, res: Response) => {
  return sendSuccess(res, TEMPLATES_BY_TYPE);
});

router.get('/:businessType', (req: Request, res: Response) => {
  const templates = TEMPLATES_BY_TYPE[req.params.businessType];
  if (!templates) {
    return sendFail(res, 404, 'NOT_FOUND', 'Unknown business type');
  }
  return sendSuccess(res, templates);
});

export default router;
