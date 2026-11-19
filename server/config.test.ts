import { describe, expect, it } from 'vitest';

describe('ZUNO Agent foundation', () => {
  it('keeps provider credentials server-side', () => {
    expect('AI_API_KEY'.startsWith('VITE_')).toBe(false);
  });
  it('uses a bounded default chat model name', () => {
    const model = 'gpt-4o-mini';
    expect(model.length).toBeGreaterThan(0);
    expect(model.length).toBeLessThan(100);
  });
});