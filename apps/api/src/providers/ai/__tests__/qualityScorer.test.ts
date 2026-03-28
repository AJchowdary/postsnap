import { scoreCaption, type ScoringContext } from '../qualityScorer';

function ctx(over: Partial<ScoringContext> = {}): ScoringContext {
  return {
    city: 'Portland',
    neighborhood: 'Pearl District',
    businessName: 'River North Cafe',
    coreServices: ['latte', 'pastries'],
    heroProduct: undefined,
    brandVibe: 'warm',
    toneOfVoice: 'conversational',
    currentMonth: 6,
    ...over,
  };
}

describe('scoreCaption', () => {
  test('high-quality caption scores >= 80 and delivers', () => {
    const caption = [
      'River North Cafe in the Pearl District, Portland — summer evenings were made for this.',
      'Grab a latte, snag pastries from the case, and say hi.',
      'We are open late tonight — stop by before 9.',
    ].join('\n');
    const q = scoreCaption(caption, ctx());
    expect(q.total).toBeGreaterThanOrEqual(80);
    expect(q.verdict).toBe('deliver');
  });

  test('retry-partial band (60–79) with identifiable weakest dimension', () => {
    const caption = [
      'The establishment provides certified latte service for Portland guests.',
      'River North Cafe offers scheduled consultations regarding pastries.',
      'Stop by today — open until 9 for summer evenings.',
      '#smallbusiness #localbusiness #shoplocal #supportlocal',
    ].join('\n');
    const q = scoreCaption(caption, ctx({ brandVibe: 'warm', toneOfVoice: undefined }));
    expect(q.total).toBeGreaterThanOrEqual(60);
    expect(q.total).toBeLessThan(80);
    expect(q.verdict).toBe('retry-partial');
    const min = Math.min(
      q.dimensions.localSpecificity,
      q.dimensions.businessSpecificity,
      q.dimensions.voiceMatch,
      q.dimensions.engagementHook,
      q.dimensions.nonGenericLanguage
    );
    expect(q.dimensions[q.weakestDimension]).toBe(min);
  });

  test('retry-full when total under 60', () => {
    const caption = 'Great.';
    const q = scoreCaption(caption, ctx());
    expect(q.total).toBeLessThan(60);
    expect(q.verdict).toBe('retry-full');
  });
});
