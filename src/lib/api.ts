import type { ChatMessage, ChatResponse } from '../types';

export async function sendChat(messages: ChatMessage[], signal?: AbortSignal): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })) }),
    signal,
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data
      ? String(data.error) : 'The assistant could not complete this request.';
    throw new Error(message);
  }
  return data as ChatResponse;
}

export async function checkHealth(): Promise<{ ok: boolean; configured: boolean }> {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error('API unavailable');
  return response.json();
}