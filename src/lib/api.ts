import type { ApprovalResponse, AgentActivity, ChatMessage, ChatResponse, HealthResponse, Repository, RepositoryFile, RepositoryTree } from '../types';

const API_URL_KEY = 'zuno:api-base-url';

export function getApiBaseUrl(): string {
  try { return localStorage.getItem(API_URL_KEY)?.trim().replace(/\/$/, '') || ''; }
  catch { return ''; }
}

export function setApiBaseUrl(value: string): void {
  const normalized = value.trim().replace(/\/$/, '');
  try {
    if (normalized) localStorage.setItem(API_URL_KEY, normalized);
    else localStorage.removeItem(API_URL_KEY);
  } catch {
    throw new Error('This device cannot save the server address.');
  }
}

function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  return base ? base + path : path;
}

async function readJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data ? String(data.error) : 'Request failed.';
    throw new Error(message);
  }
  return data as T;
}

export async function sendChat(messages: ChatMessage[], signal?: AbortSignal): Promise<ChatResponse> {
  const response = await fetch(apiUrl('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })) }),
    signal,
  });
  return readJson<ChatResponse>(response);
}

export async function checkHealth(): Promise<HealthResponse> {
  return readJson<HealthResponse>(await fetch(apiUrl('/api/health')));
}

export async function listRepositories(): Promise<Repository[]> {
  const data = await readJson<{ repositories: Repository[] }>(await fetch(apiUrl('/api/github/repos')));
  return data.repositories;
}

export async function getRepositoryTree(owner: string, repo: string, branch?: string): Promise<RepositoryTree> {
  const query = new URLSearchParams({ owner, repo });
  if (branch) query.set('branch', branch);
  return readJson<RepositoryTree>(await fetch(apiUrl('/api/github/tree?' + query)));
}

export async function getRepositoryFile(owner: string, repo: string, path: string): Promise<RepositoryFile> {
  const query = new URLSearchParams({ owner, repo, path });
  return readJson<RepositoryFile>(await fetch(apiUrl('/api/github/file?' + query)));
}

export async function approveProposal(id: string): Promise<ApprovalResponse> {
  return readJson<ApprovalResponse>(await fetch(apiUrl('/api/github/proposals/' + encodeURIComponent(id) + '/approve'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }));
}

export async function getAgentActivity(): Promise<AgentActivity[]> {
  const data = await readJson<{ events: AgentActivity[] }>(await fetch(apiUrl('/api/activity'), { cache: 'no-store' }));
  return data.events;
}
