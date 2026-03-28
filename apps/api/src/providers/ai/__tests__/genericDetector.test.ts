import {
  buildGenericRetryInstruction,
  detectGeneric,
  getBlocklist,
  type GenericDetectionContext,
} from '../genericDetector';

function baseCtx(over: Partial<GenericDetectionContext> = {}): GenericDetectionContext {
  return {
    city: 'Cedar Rapids',
    services: ['Espresso', 'Pastries'],
    heroProduct: undefined,
    brandName: 'Oak Park Café',
    currentMonth: 6,
    ...over,
  };
}

describe('detectGeneric', () => {
  test('hard fail: banned opener', () => {
    const r = detectGeneric("We're excited to share our summer menu at Oak Park Café in Cedar Rapids. Try our Espresso.", baseCtx());
    expect(r.isGeneric).toBe(true);
    expect(r.reasons).toContain('banned_opener_or_template_phrase');
  });

  test('hard fail: missing city when Brand Brain has city', () => {
    const r = detectGeneric(
      'Oak Park Café serves the best Espresso and Pastries downtown. Visit us!',
      baseCtx({ city: 'Cedar Rapids' })
    );
    expect(r.isGeneric).toBe(true);
    expect(r.reasons).toContain('missing_city_or_local_place_from_brand_brain');
  });

  test('hard fail: missing service terms when services are set', () => {
    const r = detectGeneric(
      'Oak Park Café in Cedar Rapids is award-winning and world-class. Come visit!',
      baseCtx()
    );
    expect(r.isGeneric).toBe(true);
    expect(r.reasons).toContain('missing_business_specific_noun_from_core_services_or_hero_product');
    expect(r.reasons).toContain('unconfirmed_superlative_claim');
  });

  test('pass: local + services + no banned opener', () => {
    const r = detectGeneric(
      'Oak Park Café in Cedar Rapids just pulled a new Espresso blend. Grab a Pastries pairing this week.',
      baseCtx()
    );
    expect(r.isGeneric).toBe(false);
    expect(r.reasons).toHaveLength(0);
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  test('pass: relaxed when no city and no services to enforce', () => {
    const r = detectGeneric(
      'Summer nights mean cold brew flights and neighbor meetups. Ask about our loyalty card.',
      baseCtx({ city: '', services: [] })
    );
    expect(r.isGeneric).toBe(false);
  });
});

describe('getBlocklist', () => {
  test('returns opener phrases for independent testing', () => {
    const b = getBlocklist();
    expect(b.some((x) => x.toLowerCase().includes('excited'))).toBe(true);
    expect(b.length).toBeGreaterThan(5);
  });
});

describe('buildGenericRetryInstruction', () => {
  test('retry path includes rejection reasons and constraints', () => {
    const s = buildGenericRetryInstruction(['banned_opener_or_template_phrase', 'missing_city']);
    expect(s).toContain('Previous attempt was rejected for:');
    expect(s).toContain('banned_opener_or_template_phrase');
    expect(s).toContain('business name');
    expect(s).toContain('city');
  });
});
