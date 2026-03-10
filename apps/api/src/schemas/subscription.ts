import { z } from 'zod';

export const VerifySubscriptionSchema = z
  .object({
    platform: z.enum(['ios', 'android']),
    productId: z.string().min(1, 'productId is required'),
    receipt: z.string().optional(),
    purchaseToken: z.string().optional(),
    packageName: z.string().optional(),
    transactionId: z.string().optional(),
  })
  .refine((data) => data.receipt || data.purchaseToken, {
    message: 'receipt (iOS) or purchaseToken (Android) is required',
  });

export type VerifySubscriptionBody = z.infer<typeof VerifySubscriptionSchema>;
