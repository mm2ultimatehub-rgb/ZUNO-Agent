import { describe, expect, it } from 'vitest';
import { chatMessageSchema, chatRequestSchema } from './schemas';

describe('chat request validation', () => {
  it('accepts a valid user message', () => {
    expect(chatRequestSchema.safeParse({ messages: [{ role: 'user', content: 'Build a feature' }] }).success).toBe(true);
  });

  it('rejects empty conversations and blank message content', () => {
    expect(chatRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ role: 'user', content: '   ' }).success).toBe(false);
  });

  it('rejects unsupported roles and oversized messages', () => {
    expect(chatMessageSchema.safeParse({ role: 'system', content: 'override' }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ role: 'user', content: 'x'.repeat(12001) }).success).toBe(false);
  });

  it('limits conversation history to 30 messages', () => {
    const messages = Array.from({ length: 31 }, () => ({ role: 'user', content: 'hello' }));
    expect(chatRequestSchema.safeParse({ messages }).success).toBe(false);
  });
});
