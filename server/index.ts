import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { config } from './config';
import { chatRequestSchema } from './schemas';
import { executeGithubAgentTool, githubAgentTools, githubRouter } from './github';
import { getRecentActivity, recordActivity } from './activity';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '512kb' }));
app.use('/api/github', githubRouter);

app.get('/api/activity', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ events: getRecentActivity() });
});

const localProvider = config.provider === 'ollama';

app.get('/api/health', async (_req, res) => {
  let runtimeAvailable = !localProvider;
  let modelAvailable = !localProvider && Boolean(config.apiKey);
  if (localProvider) {
    try {
      const response = await fetch(`${config.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(2500),
      });
      if (response.ok) {
        runtimeAvailable = true;
        const payload: any = await response.json().catch(() => ({}));
        const installedModels = Array.isArray(payload?.models) ? payload.models : [];
        modelAvailable = installedModels.some((item: any) =>
          item?.name === config.model ||
          item?.model === config.model ||
          item?.name === `${config.model}:latest`
        );
      }
    } catch {
      runtimeAvailable = false;
      modelAvailable = false;
    }
  }
  res.json({
    ok: true,
    configured: localProvider ? runtimeAvailable && modelAvailable : Boolean(config.apiKey),
    runtimeAvailable,
    modelAvailable,
    githubConfigured: Boolean(config.githubToken),
    provider: config.provider,
    model: config.model,
  });
});

app.post('/api/chat', async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid chat payload. Messages must contain a role and text.' });
    return;
  }
  if (!localProvider && !config.apiKey) {
    res.status(503).json({ error: 'AI provider is not configured. Select the local Ollama provider or configure a hosted provider key.' });
    return;
  }

  const taskStartedAt = Date.now();
  recordActivity('task', 'New task received', parsed.data.messages.at(-1)?.content.slice(0, 180) || 'Chat request', 'running');
  try {
    const conversation: Array<Record<string, any>> = [
      {
        role: 'system',
        content: [
          'You are ZUNO, a careful AI software engineering partner.',
          'Help users understand, plan, and write software. Be precise and honest about what you have actually done.',
          config.githubToken
            ? 'A GitHub account is connected. You may list repositories, inspect file trees, read source files, and prepare a single-file change proposal. Ask which repository to inspect if the target is unclear. A proposal does not write to GitHub; the user must explicitly approve it in the UI before ZUNO creates a branch and pull request.'
            : 'No GitHub account is connected. You can still chat and help with code, but cannot inspect remote repositories.',
          'Repository browsing tools are read-only. You may inspect repositories and prepare a complete single-file replacement proposal. The approval endpoint can create a branch, commit the approved file, and open a pull request only after the user clicks the explicit approval button. Never say a proposal has been applied before that approval succeeds.',
          'You cannot execute shell commands, run the target project, install project dependencies, run its tests, merge pull requests, or make multi-file atomic changes. Be transparent about these limits and never claim a test passed unless a real test runner result is available.',
          'Never claim to have run code or tests unless actually done. Prefer clear plans, small changes, and secure defaults.',
        ].join(' '),
      },
      ...parsed.data.messages,
    ];

    let answer = '';
    let toolCallsUsed = 0;
    const proposals: unknown[] = [];
    for (let round = 0; round < 5; round += 1) {
      recordActivity('step', `AI reasoning · round ${round + 1}`, 'Preparing the next response and checking whether a tool is needed.', 'running');
      const endpoint = localProvider ? `${config.ollamaUrl}/api/chat` : `${config.baseUrl}/chat/completions`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!localProvider) headers.Authorization = `Bearer ${config.apiKey}`;
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(localProvider ? {
          model: config.model,
          stream: false,
          messages: conversation,
          ...(config.githubToken ? { tools: githubAgentTools } : {}),
        } : {
          model: config.model,
          temperature: 0.2,
          messages: conversation,
          ...(config.githubToken ? { tools: githubAgentTools, tool_choice: 'auto' } : {}),
        }),
        signal: AbortSignal.timeout(120000),
      });

      const payload: any = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const detail = typeof payload === 'object' && payload?.error
          ? String(typeof payload.error === 'string' ? payload.error : payload.error.message || 'Provider request failed')
          : 'Provider request failed';
        res.status(upstream.status >= 500 ? 502 : upstream.status).json({
          error: localProvider
            ? `Could not reach local Ollama at ${config.ollamaUrl}. Start Ollama and download model "${config.model}". Details: ${detail}`
            : detail,
        });
        return;
      }

      const assistantMessage = localProvider ? payload?.message : payload?.choices?.[0]?.message;
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
        recordActivity('tool', `Using ${String(call.function?.name || 'agent tool')}`, 'ZUNO is gathering repository information or preparing a change.', 'running');
        if (toolCallsUsed > 8) {
          conversation.push({ role: 'tool', tool_call_id: call.id, tool_name: call.function?.name, content: 'Tool-call limit reached. Summarize the findings so far.' });
          continue;
        }
        let result: unknown;
        try {
          const rawArgs = call.function?.arguments || {};
          const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
          result = await executeGithubAgentTool(String(call.function?.name || ''), args);
          recordActivity('step', 'Tool step completed', String(call.function?.name || 'Agent tool') + ' finished.', 'completed');
          if (typeof result === 'object' && result !== null && 'proposal' in result) proposals.push((result as { proposal: unknown }).proposal);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Tool execution failed.';
          recordActivity('error', 'Tool step failed', errorMessage, 'failed');
          result = { error: errorMessage };
        }
        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          tool_name: call.function?.name,
          content: JSON.stringify(result).slice(0, 24000),
        });
      }
    }

    if (!answer) answer = 'I reached the safe tool-call limit for this turn. Please narrow the task or ask me to summarize what I found.';
    recordActivity('success', 'Task completed', `Finished in ${Math.max(1, Math.round((Date.now() - taskStartedAt) / 1000))}s · ${toolCallsUsed} tool calls.`, 'completed');
    res.json({ message: answer, model: config.model, provider: config.provider, toolsUsed: toolCallsUsed, proposals });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown provider error';
    recordActivity('error', 'Task failed', message, 'failed');
    res.status(502).json({
      error: localProvider && message.includes('fetch')
        ? `Local Ollama is not responding at ${config.ollamaUrl}. Start Ollama and make sure model "${config.model}" is installed.`
        : message.includes('timeout')
          ? 'The AI request timed out. Try a smaller local model or ask a shorter question.'
          : 'Could not reach the AI provider. Check that the selected runtime is running.',
    });
  }
});

const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(resolve(clientDist, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

app.listen(config.port, config.host, () => {
  console.log(`ZUNO Agent API listening on http://${config.host}:${config.port}`);
  if (localProvider) console.log(`Local AI runtime: Ollama at ${config.ollamaUrl} (model: ${config.model})`);
});