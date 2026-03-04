import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { TEMPLATES_BY_TYPE } from '../utils/templates';

const router = Router();

router.use(authenticate);

router.get('/', (_req: Request, res: Response) => {
  res.json(TEMPLATES_BY_TYPE);
});

router.get('/:businessType', (req: Request, res: Response) => {
  const templates = TEMPLATES_BY_TYPE[req.params.businessType];
  if (!templates) {
    res.status(404).json({ error: 'Unknown business type' });
    return;
  }
  res.json(templates);
});

export default router;
