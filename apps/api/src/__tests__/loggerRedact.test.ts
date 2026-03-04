import { redactForLog } from '../utils/logger';

describe('Log redaction', () => {
  it('redacts authorization, token, password, api_key, secret, receipt', () => {
    const out = redactForLog({
      authorization: 'Bearer eyJhbG...',
      token: 'sk-abc',
      password: 'secret123',
      api_key: 'key',
      secret: 'x',
      receipt: 'data',
      access_token: 'at',
      refresh_token: 'rt',
      service_role: 'sr',
    });
    expect(out.authorization).toBe('[REDACTED]');
    expect(out.token).toBe('[REDACTED]');
    expect(out.password).toBe('[REDACTED]');
    expect(out.api_key).toBe('[REDACTED]');
    expect(out.secret).toBe('[REDACTED]');
    expect(out.receipt).toBe('[REDACTED]');
    expect(out.access_token).toBe('[REDACTED]');
    expect(out.refresh_token).toBe('[REDACTED]');
    expect(out.service_role).toBe('[REDACTED]');
  });

  it('redacts nested keys', () => {
    const out = redactForLog({
      user: { name: 'a', password: 'p' },
      config: { api_key: 'k' },
    });
    expect(out.user).toEqual({ name: 'a', password: '[REDACTED]' });
    expect(out.config).toEqual({ api_key: '[REDACTED]' });
  });

  it('leaves safe keys unchanged', () => {
    const out = redactForLog({
      userId: 'u1',
      message: 'hello',
      count: 5,
    });
    expect(out.userId).toBe('u1');
    expect(out.message).toBe('hello');
    expect(out.count).toBe(5);
  });
});
