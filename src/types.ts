export type ChatRole = 'user' | 'assistant';
export interface ChatMessage { id: string; role: ChatRole; content: string; }
export interface ChangeProposal { id: string; fullName: string; path: string; summary: string; baseBranch: string; originalContent: string; proposedContent: string; status: 'pending' | 'approved'; }
export interface ChatResponse { message: string; model: string; toolsUsed?: number; proposals?: ChangeProposal[]; }
export interface ApprovalResponse { success: boolean; branch: string; pullRequestUrl: string; }
export interface HealthResponse { ok: boolean; configured: boolean; githubConfigured: boolean; model: string; }
export interface Repository { id: number; name: string; fullName: string; description: string | null; private: boolean; defaultBranch: string; language: string | null; url: string; updatedAt: string; }
export interface RepositoryEntry { path: string; sha: string; size: number; }
export interface RepositoryTree { repository: string; branch: string; truncated: boolean; entries: RepositoryEntry[]; }
export interface RepositoryFile { path: string; size: number; content: string; }
