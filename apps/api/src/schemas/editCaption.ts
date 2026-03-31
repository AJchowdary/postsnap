import { z } from 'zod';

export const EditCaptionSchema = z.object({
  userRequest: z.string().min(1).max(500),
  currentCaption: z.string(),
  currentHashtags: z.array(z.string()),
  businessName: z.string(),
  city: z.string(),
  ideaText: z.string(),
  chatHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(20),
});

export type EditCaptionInput = z.infer<typeof EditCaptionSchema>;
