/**
 * MetaProvider – STUBBED.
 * Simulates posting to Instagram / Facebook via the Meta Graph API.
 * TODO: Replace with real Graph API calls when META_APP_ID + META_APP_SECRET are available.
 */
import { IPostingProvider, PostPayload, PostResult } from './IPostingProvider';

export class MetaProvider implements IPostingProvider {
  async publishPost(payload: PostPayload): Promise<PostResult> {
    // Simulate a small network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Stub: always succeeds (occasionally fails to test error handling)
    const simulateFailure = false; // flip to true in testing
    if (simulateFailure) {
      return { success: false, error: 'Rate limit exceeded (simulated)' };
    }

    return {
      success: true,
      externalId: `stub_${payload.platform}_${Date.now()}`,
    };
  }
}
