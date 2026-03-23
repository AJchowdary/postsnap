import { PaymentRequiredError, type PaymentRequiredPayload } from '../utils/errors';

describe('Entitlements / 402', () => {
  it('PaymentRequiredError carries payload for 402 response', () => {
    const payload: PaymentRequiredPayload = {
      upgrade_required: true,
      reason: 'trial_ended',
      status: 'trial_expired',
      trial_end_at: '2025-03-15T00:00:00Z',
      days_left: 0,
    };
    const err = new PaymentRequiredError('Trial ended', payload);
    expect(err.statusCode).toBe(402);
    expect(err.payload).toEqual(payload);
  });
});
