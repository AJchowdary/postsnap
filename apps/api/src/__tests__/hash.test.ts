import { generationHash, isGenerationCacheHit } from '../utils/hash';

describe('Generation hash', () => {
  it('same inputs produce same hash', () => {
    const params = {
      originalImagePath: 'path/to/img.jpg',
      templateId: 'auto',
      contextText: 'Test',
      brandStyle: 'clean',
      brandColor: '#fff',
      overlayDefaultOn: false,
      logoUrl: null,
      overlayText: null,
      modelQuality: 'default',
    };
    expect(generationHash(params)).toBe(generationHash(params));
  });
  it('different contextText produces different hash', () => {
    const base = {
      originalImagePath: null,
      templateId: 'auto',
      contextText: 'A',
      brandStyle: 'clean',
      brandColor: null,
      overlayDefaultOn: false,
      logoUrl: null,
      overlayText: null,
      modelQuality: 'default',
    };
    const hashA = generationHash(base);
    const hashB = generationHash({ ...base, contextText: 'B' });
    expect(hashA).not.toBe(hashB);
  });
  it('different modelQuality produces different hash', () => {
    const base = {
      originalImagePath: null,
      templateId: 'auto',
      contextText: 'Test',
      brandStyle: 'clean',
      brandColor: null,
      overlayDefaultOn: false,
      logoUrl: null,
      overlayText: null,
      modelQuality: 'default',
    };
    expect(generationHash(base)).not.toBe(generationHash({ ...base, modelQuality: 'premium' }));
  });
});

describe('isGenerationCacheHit', () => {
  const hash = 'abc123';

  it('returns true when hash matches and caption + (processed or no original) exist', () => {
    expect(
      isGenerationCacheHit(
        { lastGeneratedHash: hash, captionJson: { instagram: {}, facebook: {} }, processedImagePath: '/p.jpg', originalImagePath: '/o.jpg' },
        hash
      )
    ).toBe(true);
    expect(
      isGenerationCacheHit(
        { lastGeneratedHash: hash, captionJson: {}, processedImagePath: null, originalImagePath: null },
        hash
      )
    ).toBe(true);
  });

  it('returns false when hash differs (so regen_count would increment)', () => {
    expect(
      isGenerationCacheHit(
        { lastGeneratedHash: 'other', captionJson: {}, processedImagePath: null, originalImagePath: null },
        hash
      )
    ).toBe(false);
  });

  it('returns false when captionJson missing (so regen_count would increment)', () => {
    expect(
      isGenerationCacheHit(
        { lastGeneratedHash: hash, captionJson: null, processedImagePath: null, originalImagePath: null },
        hash
      )
    ).toBe(false);
  });

  it('returns false when original exists but processed missing (needs generation)', () => {
    expect(
      isGenerationCacheHit(
        { lastGeneratedHash: hash, captionJson: {}, processedImagePath: null, originalImagePath: '/o.jpg' },
        hash
      )
    ).toBe(false);
  });
});
