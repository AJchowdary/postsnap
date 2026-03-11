import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  CreatePostSchema,
  CreatePostBody,
  UploadCompleteSchema,
  GeneratePostSchema,
  PublishPostSchema,
} from '../schemas/posts';
import {
  listPosts,
  getPost,
  createPost,
  markUploadComplete,
  deletePost,
  enqueueGenerate,
  publishPost,
} from '../services/postsService';
import { asyncHandler } from '../utils/asyncHandler';
import { postsRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.use(authenticate);
router.use(postsRateLimiter);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filter = (req.query.filter as string) || req.query.status as string;
  const posts = await listPosts(req.userId!, filter);
  res.json(posts);
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const post = await getPost(req.userId!, req.params.id);
  res.json(post);
}));

router.post(
  '/',
  validate(CreatePostSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as CreatePostBody;
    const result = await createPost(req.userId!, {
      template_id: body.template_id,
      context_text: body.context_text,
      platforms: body.platforms,
      status: body.status,
    });
    res.status(201).json(result);
  })
);

router.post(
  '/:id/upload-complete',
  validate(UploadCompleteSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const post = await markUploadComplete(req.userId!, req.params.id, req.body.path);
    res.json(post);
  })
);

router.post(
  '/:id/generate',
  validate(GeneratePostSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { jobId, status } = await enqueueGenerate(
      req.userId!,
      req.params.id,
      req.body.premium_quality
    );
    res.status(202).json({ jobId, status });
  })
);

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  await deletePost(req.userId!, req.params.id);
  res.json({ success: true });
}));

router.post(
  '/:id/publish',
  validate(PublishPostSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    const result = await publishPost(req.userId!, req.params.id, req.body, idempotencyKey);
    if ('jobId' in result && result.jobId) {
      return res.status(202).json({ jobId: result.jobId, status: result.status });
    }
    res.status(200).json(result);
  })
);

export default router;
