# ZUNO Agent

A self-hostable AI software engineering workspace. ZUNO Agent helps developers understand a codebase, plan implementation work, and collaborate with an AI assistant through a polished glass-inspired workspace.

## Current release

This repository contains the first working foundation: a responsive animated React workspace, a server-side OpenAI-compatible chat adapter, health checks, and a safe-by-default architecture. Repository mutation, terminal execution, and GitHub write access are not enabled yet; they will be added behind explicit approvals and isolated execution.

## Stack

- React 18, TypeScript, Vite
- Express API, Node.js
- OpenAI-compatible Chat Completions API via server-side fetch
- Zod validation, Vitest

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The API listens on http://localhost:8787.

Set `AI_API_KEY` in `.env`. Optional settings: `AI_BASE_URL` and `AI_MODEL`. Provider credentials must never be exposed to the browser.

## Safety principles

- API keys remain server-side.
- The initial release does not execute arbitrary shell commands or push commits.
- Future tools must use workspace isolation, approval gates, and auditable operations.

## License

MIT
