import { config } from '../config';

describe('Regen limits', () => {
  it('trial regen limit per post is 1', () => {
    expect(config.regenLimitTrialPerPost).toBe(1);
  });
  it('paid regen limit per post is 2', () => {
    expect(config.regenLimitPaidPerPost).toBe(2);
  });
  it('paid regen limit per day is 10', () => {
    expect(config.regenLimitPaidPerDay).toBe(10);
  });
});
