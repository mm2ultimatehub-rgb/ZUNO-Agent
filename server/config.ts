import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || '127.0.0.1',
  provider: process.env.AI_PROVIDER || 'ollama',
  apiKey: process.env.AI_API_KEY || '',
  githubToken: process.env.GITHUB_TOKEN || '',
  baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
  ollamaUrl: (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
  model: process.env.AI_MODEL || 'qwen2.5-coder:3b',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};