# ZUNO Agent

A self-hostable AI software engineering workspace with a glass-inspired React interface and a server-side AI agent.

## Current capabilities

- Animated, responsive React workspace with glassmorphism styling.
- OpenAI-compatible chat endpoint; provider keys stay on the server.
- Optional GitHub connection for listing repositories, browsing file trees, and reading source files.
- Bounded model tool-calling loop for repository inspection and reviewable file-change proposals.
- Explicit approval flow that creates a branch and pull request; it never merges automatically.
- Request validation, file-size limits, and a GitHub Actions CI workflow.

## Not enabled yet

This is an early foundation, not a finished autonomous coding agent. It can inspect repositories and prepare complete single-file replacements. After a user explicitly approves a proposal, it creates a branch, commits that file, and opens a pull request when the token has sufficient permissions. It does not run project commands, execute arbitrary code, or merge pull requests.

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

For GitHub browsing, set `GITHUB_TOKEN` to a fine-grained token with **Metadata: read** and **Contents: read** permissions. To approve proposals and create pull requests, also grant **Contents: write** and **Pull requests: write** for the repositories ZUNO should modify. Never expose this token through a `VITE_*` variable or commit it to Git.

## Safety

- Provider and GitHub credentials stay server-side.
- The API binds to `127.0.0.1` by default; do not expose it publicly until authentication and deployment hardening are added.
- Source previews are limited to text files up to 100 KB; proposed replacements are limited to 40 KB.
- Agent tool calls are allowlisted and bounded per request.
- GitHub writes occur only after an explicit approval click, on a new branch, and are submitted as a pull request. Nothing is merged automatically.
- Arbitrary shell execution is not enabled.

## License

MIT
