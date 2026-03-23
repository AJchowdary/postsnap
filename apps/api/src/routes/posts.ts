import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  CreatePostBodySchema,
  CreatePostInput,
  UploadCompleteSchema,
  GeneratePostSchema,
  PublishPostSchema,
} from '../schemas/posts';
import {
  listPosts,
  getPost,
  createPost,
  savePost,
  markUploadComplete,
  deletePost,
  enqueueGenerate,
  publishPost,
} from '../services/postsService';
import { asyncHandler } from '../utils/asyncHandler';
import { socialPublishRateLimiter } from '../middleware/rateLimit';
import { sendSuccess } from '../utils/apiResponse';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filter = (req.query.filter as string) || (req.query.status as string);
  const posts = await listPosts(req.userId!, filter);
  return sendSuccess(res, posts);
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const post = await getPost(req.userId!, req.params.id);
  return sendSuccess(res, post);
}));

router.post(
  '/',
  validate(CreatePostBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as CreatePostInput;
    if (body.postId) {
      const result = await savePost(req.userId!, body);
      return sendSuccess(res, result);
    }
    const result = await createPost(req.userId!, {
      template_id: body.template,
      context_text: body.description,
      platforms: body.platforms,
      status: body.status,
    });
    return sendSuccess(res, result, 201);
  })
);

router.post(
  '/:id/upload-complete',
  validate(UploadCompleteSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const post = await markUploadComplete(req.userId!, req.params.id, req.body.path);
    return sendSuccess(res, post);
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
    return sendSuccess(res, { jobId, status }, 202);
  })
);

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  await deletePost(req.userId!, req.params.id);
  return sendSuccess(res, { deleted: true });
}));

router.post(
  '/:id/publish',
  socialPublishRateLimiter,
  validate(PublishPostSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    const result = await publishPost(req.userId!, req.params.id, req.body, idempotencyKey);
    if ('jobId' in result && result.jobId) {
      return sendSuccess(res, { jobId: result.jobId, status: result.status }, 202);
    }
    return sendSuccess(res, result);
  })
);

export default router;
