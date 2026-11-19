import express from 'express';
import cors from 'cors';
import { config } from './config';
import { chatRequestSchema } from './schemas';
import { executeGithubAgentTool, githubAgentTools, githubRouter } from './github';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '64kb' }));
app.use('/api/github', githubRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, configured: Boolean(config.apiKey), githubConfigured: Boolean(config.githubToken), model: config.model });
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
    const conversation: Array<Record<string, any>> = [
      {
        role: 'system',
        content: [
          'You are ZUNO Agent, a careful AI software engineering partner.',
          'Help users understand, plan, and write software. Be precise and honest about what you have actually done.',
          config.githubToken
            ? 'A GitHub account is connected. You may use the available read-only tools to list repositories, inspect file trees, and read source files when relevant. Ask which repository to inspect if the target is unclear.'
            : 'No GitHub account is connected yet. You cannot inspect a repository until the user configures GITHUB_TOKEN on the server.',
          'Repository tools are read-only in this release: do not claim to edit files, run tests, create branches, or push commits.',
          'Never claim to have run code or tests unless actually done. Prefer clear plans, small changes, and secure defaults.',
        ].join(' '),
      },
      ...parsed.data.messages,
    ];

    let answer = '';
    let toolCallsUsed = 0;
    for (let round = 0; round < 5; round += 1) {
      const upstream = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          messages: conversation,
          ...(config.githubToken ? { tools: githubAgentTools, tool_choice: 'auto' } : {}),
        }),
        signal: AbortSignal.timeout(60000),
      });

      const payload: any = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const detail = typeof payload === 'object' && payload?.error
          ? String(payload.error.message || 'Provider request failed')
          : 'Provider request failed';
        res.status(upstream.status >= 500 ? 502 : upstream.status).json({ error: detail });
        return;
      }

      const assistantMessage = payload?.choices?.[0]?.message;
      if (!assistantMessage) {
        res.status(502).json({ error: 'The AI provider returned an empty response.' });
        return;
      }
      const calls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
      if (calls.length === 0) {
        answer = typeof assistantMessage.content === 'string' ? assistantMessage.content : '';
        break;
      }

      conversation.push(assistantMessage);
      for (const call of calls) {
        toolCallsUsed += 1;
        if (toolCallsUsed > 8) {
          conversation.push({ role: 'tool', tool_call_id: call.id, content: 'Tool-call limit reached. Summarize the findings so far.' });
          continue;
        }
        let result: unknown;
        try {
          const args = JSON.parse(call.function?.arguments || '{}');
          result = await executeGithubAgentTool(String(call.function?.name || ''), args);
        } catch (error) {
          result = { error: error instanceof Error ? error.message : 'Tool execution failed.' };
        }
        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 24000),
        });
      }
    }

    if (!answer) answer = 'I reached the safe tool-call limit for this turn. Please narrow the task or ask me to summarize what I found.';
    res.json({ message: answer, model: config.model, toolsUsed: toolCallsUsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown provider error';
    res.status(502).json({ error: message.includes('timeout') ? 'The AI request timed out. Please try again.' : 'Could not reach the AI provider. Check your server configuration.' });
  }
});

app.listen(config.port, () => {
  console.log(`ZUNO Agent API listening on http://localhost:${config.port}`);
});
