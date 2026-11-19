import express from 'express';
import cors from 'cors';
import { config } from './config';
import { chatRequestSchema } from './schemas';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, configured: Boolean(config.apiKey), model: config.model });
});

app.post('/api/chat', async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid chat payload. Messages must contain a role and text.' });
    return;
  }
  if (!config.apiKey) {
    res.status(503).json({ error: 'AI is not configured yet. Add AI_API_KEY to your server .env file, then restart ZUNO Agent.' });
    return;
  }

  try {
    const upstream = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'You are ZUNO Agent, a careful AI software engineering partner. Help users understand, plan, and write software. Be honest about capabilities: you cannot inspect or modify their repository unless a connected tool explicitly provides that ability. Never claim to have run code or tests unless actually done. Prefer clear plans, small changes, and secure defaults.',
          },
          ...parsed.data.messages,
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });

    const payload: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = typeof payload === 'object' && payload && 'error' in payload
        ? String((payload.error as { message?: string })?.message || 'Provider request failed')
        : 'Provider request failed';
      res.status(upstream.status >= 500 ? 502 : upstream.status).json({ error: detail });
      return;
    }
    const content = (payload as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: 'The AI provider returned an empty response.' });
      return;
    }
    res.json({ message: content, model: config.model });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown provider error';
    res.status(502).json({ error: message.includes('timeout') ? 'The AI request timed out. Please try again.' : 'Could not reach the AI provider. Check your server configuration.' });
  }
});

app.listen(config.port, () => {
  console.log(`ZUNO Agent API listening on http://localhost:${config.port}`);
});