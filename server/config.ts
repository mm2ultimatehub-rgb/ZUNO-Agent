import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 8787),
  apiKey: process.env.AI_API_KEY || '',
  githubToken: process.env.GITHUB_TOKEN || '',
  baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
  model: process.env.AI_MODEL || 'gpt-4o-mini',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};