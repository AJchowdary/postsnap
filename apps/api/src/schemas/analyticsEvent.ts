import { z } from 'zod';
import { ANALYTICS_EVENT_NAMES } from '../services/analyticsEvents';

const eventTuple = ANALYTICS_EVENT_NAMES as unknown as [string, ...string[]];

export const TrackAnalyticsEventSchema = z.object({
  event: z.enum(eventTuple),
  postId: z.string().uuid().optional(),
  properties: z.record(z.unknown()).optional(),
});

export type TrackAnalyticsEventInput = z.infer<typeof TrackAnalyticsEventSchema>;
