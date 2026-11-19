import type { ChatMessage, ChatResponse, HealthResponse, Repository, RepositoryFile, RepositoryTree } from '../types';

async function readJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data ? String(data.error) : 'Request failed.';
    throw new Error(message);
  }
  return data as T;
}

export async function sendChat(messages: ChatMessage[], signal?: AbortSignal): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })) }),
    signal,
  });
  return readJson<ChatResponse>(response);
}

export async function checkHealth(): Promise<HealthResponse> {
  return readJson<HealthResponse>(await fetch('/api/health'));
}

export async function listRepositories(): Promise<Repository[]> {
  const data = await readJson<{ repositories: Repository[] }>(await fetch('/api/github/repos'));
  return data.repositories;
}

export async function getRepositoryTree(owner: string, repo: string, branch?: string): Promise<RepositoryTree> {
  const query = new URLSearchParams({ owner, repo });
  if (branch) query.set('branch', branch);
  return readJson<RepositoryTree>(await fetch(`/api/github/tree?${query}`));
}

export async function getRepositoryFile(owner: string, repo: string, path: string): Promise<RepositoryFile> {
  const query = new URLSearchParams({ owner, repo, path });
  return readJson<RepositoryFile>(await fetch(`/api/github/file?${query}`));
}
