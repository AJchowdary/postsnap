import { ScanWebsiteSchema } from '../schemas/account';
import { parseHttpOrHttpsWebsiteUrl } from '../utils/websiteUrl';

describe('parseHttpOrHttpsWebsiteUrl', () => {
  it('accepts bare hostnames and returns https href', () => {
    expect(parseHttpOrHttpsWebsiteUrl('example.com')).toBe('https://example.com/');
    expect(parseHttpOrHttpsWebsiteUrl('  cafe.io/path  ')).toBe('https://cafe.io/path');
  });

  it('preserves explicit http and https URLs', () => {
    expect(parseHttpOrHttpsWebsiteUrl('http://a.test/')).toBe('http://a.test/');
    expect(parseHttpOrHttpsWebsiteUrl('https://b.test/x?q=1')).toBe('https://b.test/x?q=1');
  });

  it('rejects empty, javascript, and data URLs', () => {
    expect(parseHttpOrHttpsWebsiteUrl('')).toBeNull();
    expect(parseHttpOrHttpsWebsiteUrl('   ')).toBeNull();
    expect(parseHttpOrHttpsWebsiteUrl('javascript:alert(1)')).toBeNull();
    expect(parseHttpOrHttpsWebsiteUrl('data:text/html,<x>')).toBeNull();
  });

  it('rejects non-http(s) schemes', () => {
    expect(parseHttpOrHttpsWebsiteUrl('ftp://files.example/x')).toBeNull();
  });
});

describe('ScanWebsiteSchema', () => {
  it('parses and normalizes valid websiteUrl', () => {
    const a = ScanWebsiteSchema.safeParse({ websiteUrl: '  myshop.com  ' });
    expect(a.success).toBe(true);
    if (a.success) {
      expect(a.data.websiteUrl).toMatch(/^https:\/\/myshop\.com\/?$/);
    }
  });

  it('rejects missing or whitespace-only URL', () => {
    expect(ScanWebsiteSchema.safeParse({ websiteUrl: '' }).success).toBe(false);
    expect(ScanWebsiteSchema.safeParse({ websiteUrl: '  \n  ' }).success).toBe(false);
  });

  it('rejects javascript: and overlong strings', () => {
    expect(ScanWebsiteSchema.safeParse({ websiteUrl: 'javascript:void(0)' }).success).toBe(false);
    const long = 'https://x.com/' + 'a'.repeat(3000);
    expect(ScanWebsiteSchema.safeParse({ websiteUrl: long }).success).toBe(false);
  });
});
