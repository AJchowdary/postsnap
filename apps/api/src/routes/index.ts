import { Router } from 'express';
import authRouter from './auth';
import accountRouter from './account';
import postsRouter from './posts';
import generateRouter from './generate';
import socialRouter from './social';
import subscriptionRouter from './subscription';
import templatesRouter from './templates';
import adminRouter from './admin';
import campaignsRouter from './campaigns';
import productsRouter from './products';

const router = Router();

router.use('/auth', authRouter);
router.use('/account', accountRouter);
router.use('/posts', postsRouter);
router.use('/generate', generateRouter);
router.use('/social', socialRouter);
router.use('/subscription', subscriptionRouter);
router.use('/templates', templatesRouter);
router.use('/admin', adminRouter);
router.use('/campaigns', campaignsRouter);
router.use('/products', productsRouter);

export { router as routes };
