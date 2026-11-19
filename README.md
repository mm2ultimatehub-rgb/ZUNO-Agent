# ZUNO Agent

A self-hostable AI software engineering workspace with a glass-inspired React interface and a local-first AI runtime.

## Current capabilities

- Animated, responsive React workspace with glassmorphism styling.
- Local recent-session history and an activity view, plus a repository-browser shortcut for code-review requests.
- **Local AI chat through Ollama by default. No API key or paid hosted AI account is required for this mode.**
- Optional hosted OpenAI-compatible provider mode.
- Optional GitHub connection for listing repositories, browsing file trees, and reading source files.
- Bounded model tool-calling loop for repository inspection and reviewable file-change proposals.
- Explicit approval flow that creates a branch and pull request; it never merges automatically.
- Request validation, file-size limits, a GitHub Actions CI workflow, and production static-file serving from the API process.

## Important: what "built from scratch" means here

ZUNO's application, chat orchestration, memory/session handling, interface, GitHub tools, and safety/approval workflow are our own code. The language model itself is not secretly trained from scratch by this repository: local inference is provided by Ollama running an openly available model on your own computer. Training a competitive foundation model from zero requires large datasets and substantial GPU resources. ZUNO does not need a hosted API key to run the local model.

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com/) installed locally
- Enough RAM for the selected model (the default 3B model is intended for modest local hardware)
- Optional GitHub fine-grained personal access token for repository inspection

## Development

1. Install Ollama.
2. Download the default model once:

   ```bash
   ollama pull qwen2.5-coder:3b
   ```

3. Install and start ZUNO:

   ```bash
   npm install
   cp .env.example .env
   npm run dev
   ```

For development, open http://localhost:5173; the API listens on http://127.0.0.1:8787. Ollama must be running in the background at http://127.0.0.1:11434. For a production-style local run, use `npm run build` followed by `npm start`, then open http://127.0.0.1:8787.

### Use ZUNO from a phone on the same Wi-Fi

The AI model runs on the computer, not inside the phone browser. Keep Ollama and the ZUNO server running on that computer, then:

1. Find the computer's private LAN IP address (for example, `192.168.1.20`).
2. In `.env`, set `HOST=0.0.0.0` and `CLIENT_ORIGIN=http://192.168.1.20:5173` (replace the example IP with the computer's actual address).
3. Start ZUNO with `npm run dev`, allow the app through the computer's firewall on your **private home network only**, and open `http://192.168.1.20:5173` on the phone.
4. Do not expose the development server or unauthenticated API directly to the public internet. For remote access outside your Wi-Fi, deploy a secured backend with authentication and HTTPS first.

This is local-network access: the phone is the interface, while Ollama and the model remain on the computer.

## Environment

The default `AI_PROVIDER=ollama` mode uses `OLLAMA_URL` and `AI_MODEL`; it does not use `AI_API_KEY`. You can change the local model with `AI_MODEL` after downloading it through Ollama.

To use a hosted OpenAI-compatible service instead, set `AI_PROVIDER=openai`, `AI_API_KEY`, and optionally `AI_BASE_URL`. Hosted API usage may be billed separately by its provider.

For GitHub browsing, set `GITHUB_TOKEN` to a fine-grained token with **Metadata: read** and **Contents: read** permissions. To approve proposals and create pull requests, also grant **Contents: write** and **Pull requests: write** for the repositories ZUNO should modify. Never expose this token through a `VITE_*` variable or commit it to Git.

## Safety and current limitations

- Local model inference runs on the machine where Ollama is installed; the default server binds to `127.0.0.1`.
- Provider and GitHub credentials (if used) stay server-side.
- Source previews are limited to text files up to 100 KB; proposed replacements are limited to 40 KB.
- Agent tool calls are allowlisted and bounded per request.
- The model cannot invoke a shell, install dependencies, or execute repository code. Treat all generated changes as untrusted until reviewed and tested.
- This is an early coding workspace, not yet a fully autonomous coding agent. It can inspect repositories and prepare complete single-file replacements. After explicit approval, it creates a branch, commits that file, and opens a pull request when permissions allow.
- It does not run project commands, execute arbitrary code, install project dependencies, run repository tests, apply multi-file changes atomically, or merge pull requests.
- Pending proposals are held in server memory for up to one hour; restarting the server clears them.
- The latest 20 chat sessions are stored in browser local storage on that device (up to 100 messages per session); they are not synchronized across devices. Proposal review cards are temporary and are not restored after a reload.
- GitHub writes occur only after an explicit approval click, on a new branch, and are submitted as a pull request. Nothing is merged automatically.

## License

MIT


## Mobile voice controls

The chat composer includes browser-based speech input and spoken replies. Use the microphone button to dictate Turkish text into the composer, then send it normally; use the speaker button to enable or disable spoken assistant replies. Voice recognition depends on browser support and microphone permission. Browsers generally require a secure context (HTTPS, or localhost) for microphone access, so a plain `http://192.168.x.x` same-Wi-Fi address may allow chat but block voice input. Use a trusted HTTPS deployment or a private HTTPS tunnel for phone voice access; do not expose the unauthenticated development server directly to the public internet.
