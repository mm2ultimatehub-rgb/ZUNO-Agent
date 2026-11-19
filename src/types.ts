export type ChatRole = 'user' | 'assistant';
export interface ChatMessage { id: string; role: ChatRole; content: string; }
export interface ChatResponse { message: string; model: string; }
