# ZUNO Agent

A self-hostable AI software engineering workspace with a glass-inspired React interface and a server-side AI agent.

## Current capabilities

- Animated, responsive React workspace with glassmorphism styling.
- OpenAI-compatible chat endpoint; provider keys stay on the server.
- Optional GitHub connection for listing repositories, browsing file trees, and reading source files.
- Bounded model tool-calling loop with read-only GitHub tools.
- Request validation, file-size limits, and a GitHub Actions CI workflow.

## Not enabled yet

This is an early foundation, not a finished autonomous coding agent. The current GitHub tools are read-only. It cannot yet edit repository files, run project commands, create branches, commit, or open pull requests. Those capabilities will be introduced behind explicit approvals and isolated execution.

## Requirements

- Node.js 20+
- An OpenAI-compatible provider API key
- Optional GitHub fine-grained personal access token for repository inspection

## Development

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The API listens on http://localhost:8787.

## Environment

Set `AI_API_KEY` on the server. Optional provider settings are `AI_BASE_URL` and `AI_MODEL`.

For GitHub repository browsing and agent inspection, set `GITHUB_TOKEN` to a fine-grained token with read-only **Metadata** and **Contents** permissions for the repositories you want ZUNO to access. Never expose this token through a `VITE_*` variable or commit it to Git.

## Safety

- Provider and GitHub credentials stay server-side.
- GitHub access is read-only in this release.
- Source previews are limited to text files up to 100 KB.
- Agent tool calls are allowlisted and bounded per request.
- Future write and execution tools must use workspace isolation, explicit user approval, and auditable operations.

## License

MIT
