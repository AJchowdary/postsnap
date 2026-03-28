import { Router } from 'express';
import authRouter from './auth';
import accountRouter from './account';
import postsRouter from './posts';
import generateRouter from './generate';
import socialRouter from './social';
import subscriptionRouter from './subscription';
import templatesRouter from './templates';
import adminRouter from './admin';

const router = Router();

router.use('/auth', authRouter);
router.use('/account', accountRouter);
router.use('/posts', postsRouter);
router.use('/generate', generateRouter);
router.use('/social', socialRouter);
router.use('/subscription', subscriptionRouter);
router.use('/templates', templatesRouter);
router.use('/admin', adminRouter);

export { router as routes };
