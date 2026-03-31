import { CreatePostBodySchema } from '../schemas/posts';

describe('CreatePostBodySchema (scheduled)', () => {
  const base = {
    template: 'auto',
    description: 'Hello',
    caption: 'Cap',
    platforms: ['instagram'] as const,
  };

  it('accepts scheduled status with future scheduledAt', () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const r = CreatePostBodySchema.safeParse({
      ...base,
      status: 'scheduled',
      scheduledAt: future,
    });
    expect(r.success).toBe(true);
  });

  it('rejects scheduled without scheduledAt', () => {
    const r = CreatePostBodySchema.safeParse({
      ...base,
      status: 'scheduled',
    });
    expect(r.success).toBe(false);
  });

  it('rejects scheduledAt when status is draft', () => {
    const r = CreatePostBodySchema.safeParse({
      ...base,
      status: 'draft',
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(r.success).toBe(false);
  });
});
