import { Router } from 'express';
import { z } from 'zod';
import { config } from './config';
import { createProposal, getProposal, markProposalApproved } from './proposals';

export const githubRouter = Router();

const repositoryName = z.string().regex(/^[A-Za-z0-9_.-]+$/);
const ownerName = z.string().regex(/^[A-Za-z0-9-]+$/);
const repoParams = z.object({ owner: ownerName, repo: repositoryName });
const fileParams = repoParams.extend({
  path: z.string().min(1).max(500).refine((value) => !value.startsWith('/') && !value.split('/').includes('..'), 'Invalid repository path'),
});


async function githubWrite(method: 'POST' | 'PUT', path: string, body: unknown) {
  if (!config.githubToken) throw new Error('GitHub is not configured. Add GITHUB_TOKEN to the server .env file.');
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'ZUNO-Agent',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) throw new Error('GitHub rejected the token. Check GITHUB_TOKEN.');
    if (response.status === 403) throw new Error('GitHub denied the write. Approval requires Contents: write and Pull requests: write permissions.');
    throw new Error(payload?.message || `GitHub write failed with status ${response.status}.`);
  }
  return payload;
}

const proposalArgsSchema = repoParams.extend({
  path: fileParams.shape.path,
  summary: z.string().trim().min(5).max(120),
  content: z.string().min(1).max(40000),
});

async function prepareFileProposal(rawArgs: Record<string, unknown>) {
  const parsed = proposalArgsSchema.safeParse(rawArgs);
  if (!parsed.success) throw new Error('A proposal needs a valid owner, repository, file path, short summary, and file content (maximum 40 KB).');
  const { owner, repo, path, summary, content } = parsed.data;
  const metadata = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  const baseBranch = metadata.default_branch as string;
  const refPath = baseBranch.split('/').map(encodeURIComponent).join('/');
  const ref = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${refPath}`);
  let originalSha: string | null = null;
  let originalContent = '';
  try {
    const existing = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`);
    if (Array.isArray(existing) || existing.type !== 'file' || existing.size > 40000 || !existing.content) {
      throw new Error('The target is not a supported text file or is larger than 40 KB.');
    }
    originalSha = existing.sha;
    originalContent = Buffer.from(existing.content, 'base64').toString('utf8');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Repository or file was not found')) throw error;
  }
  const proposal = createProposal({
    owner, repo, path, summary, baseBranch,
    baseSha: ref.object.sha,
    originalSha,
    originalContent,
    proposedContent: content,
  });
  return {
    proposal: {
      id: proposal.id,
      fullName: `${owner}/${repo}`,
      path,
      summary,
      baseBranch,
      originalContent,
      proposedContent: content,
      status: proposal.status,
    },
  };
}


async function githubFetch(path: string) {
  if (!config.githubToken) throw new Error('GitHub is not configured. Add GITHUB_TOKEN to the server .env file.');
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ZUNO-Agent',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('GitHub rejected the token. Check GITHUB_TOKEN.');
    if (response.status === 403) throw new Error('GitHub denied access. The token may need repository read permission.');
    if (response.status === 404) throw new Error('Repository or file was not found, or the token cannot access it.');
    throw new Error(`GitHub request failed with status ${response.status}.`);
  }
  return response.json() as Promise<any>;
}

githubRouter.get('/repos', async (_req, res) => {
  try {
    const repos = await githubFetch('/user/repos?per_page=50&sort=updated&affiliation=owner,collaborator,organization_member');
    res.json({
      repositories: repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        defaultBranch: repo.default_branch,
        language: repo.language,
        url: repo.html_url,
        updatedAt: repo.updated_at,
      })),
    });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Could not load GitHub repositories.' });
  }
});

githubRouter.get('/tree', async (req, res) => {
  const parsed = repoParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide a valid owner and repository name.' });
    return;
  }
  try {
    const { owner, repo } = parsed.data;
    const metadata = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const branch = typeof req.query.branch === 'string' ? req.query.branch : metadata.default_branch;
    if (branch.length > 200 || branch.includes('..')) {
      res.status(400).json({ error: 'Invalid branch name.' });
      return;
    }
    const tree = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    res.json({
      repository: metadata.full_name,
      branch,
      truncated: Boolean(tree.truncated),
      entries: (tree.tree || []).filter((entry: any) => entry.type === 'blob').slice(0, 500).map((entry: any) => ({
        path: entry.path,
        sha: entry.sha,
        size: entry.size,
      })),
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not read repository tree.' });
  }
});

githubRouter.get('/file', async (req, res) => {
  const parsed = fileParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide a valid owner, repository, and file path.' });
    return;
  }
  try {
    const { owner, repo, path } = parsed.data;
    const file = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`);
    if (Array.isArray(file) || file.type !== 'file' || file.size > 100_000 || !file.content) {
      res.status(413).json({ error: 'This file is not a supported text file or exceeds the 100 KB preview limit.' });
      return;
    }
    res.json({ path: file.path, size: file.size, content: Buffer.from(file.content, 'base64').toString('utf8') });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not read repository file.' });
  }
});


githubRouter.post('/proposals/:id/approve', async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: 'Invalid proposal ID.' });
    return;
  }
  const proposal = getProposal(id.data);
  if (!proposal) {
    res.status(404).json({ error: 'This proposal is missing, expired, or already approved. Ask ZUNO to prepare it again.' });
    return;
  }
  try {
    const { owner, repo, baseBranch, baseSha, originalSha, path, proposedContent, summary } = proposal;
    const prefix = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const branch = `zuno-agent/${proposal.id.slice(0, 8)}`;
    const refPath = baseBranch.split('/').map(encodeURIComponent).join('/');
    const latestRef = await githubFetch(`${prefix}/git/ref/heads/${refPath}`);
    if (latestRef.object.sha !== baseSha) {
      res.status(409).json({ error: 'The base branch changed after this proposal was prepared. Ask ZUNO to refresh the proposal before approving.' });
      return;
    }
    await githubWrite('POST', `${prefix}/git/refs`, { ref: `refs/heads/${branch}`, sha: baseSha });
    const contentPath = path.split('/').map(encodeURIComponent).join('/');
    const commitBody: Record<string, unknown> = {
      message: `zuno: ${summary}`,
      content: Buffer.from(proposedContent, 'utf8').toString('base64'),
      branch,
    };
    if (originalSha) commitBody.sha = originalSha;
    await githubWrite('PUT', `${prefix}/contents/${contentPath}`, commitBody);
    let pullRequestUrl = '';
    let pullRequestCreated = true;
    try {
      const pull = await githubWrite('POST', `${prefix}/pulls`, {
        title: summary,
        head: branch,
        base: baseBranch,
        body: `Prepared by ZUNO Agent and approved by the user.\n\nFile: \`${path}\`\n\nPlease review the changes and run the repository checks before merging.`,
      });
      pullRequestUrl = pull.html_url || '';
    } catch {
      pullRequestCreated = false;
      pullRequestUrl = `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(branch)}`;
    }
    markProposalApproved(proposal.id);
    res.json({ success: true, branch, pullRequestUrl, pullRequestCreated });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not apply the approved proposal.' });
  }
});

export const githubAgentTools = [
  {
    type: 'function',
    function: {
      name: 'list_repositories',
      description: 'List repositories accessible to the connected GitHub account. Use this when the user asks what projects are available.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_repository_tree',
      description: 'List file paths in a GitHub repository. Requires owner and repo; branch is optional.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'GitHub owner login' },
          repo: { type: 'string', description: 'Repository name without owner' },
          branch: { type: 'string', description: 'Optional branch name' },
        },
        required: ['owner', 'repo'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_repository_file',
      description: 'Read a text file from a GitHub repository (maximum 100 KB).',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          path: { type: 'string', description: 'File path relative to repository root' },
        },
        required: ['owner', 'repo', 'path'],
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'propose_file_change',
      description: 'Prepare a complete replacement for one repository text file as a reviewable proposal. This never writes to GitHub. Use only after inspecting the target file and explaining the intended change. The user must approve it in the UI before a branch or pull request is created.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          path: { type: 'string' },
          summary: { type: 'string', description: 'Short change summary' },
          content: { type: 'string', description: 'Complete new file contents, not a diff' },
        },
        required: ['owner', 'repo', 'path', 'summary', 'content'],
        additionalProperties: false,
      },
    },
  },
] as const;

export async function executeGithubAgentTool(name: string, rawArgs: unknown): Promise<unknown> {
  const args = typeof rawArgs === 'object' && rawArgs !== null ? rawArgs as Record<string, unknown> : {};
  if (name === 'propose_file_change') return prepareFileProposal(args);
  if (name === 'list_repositories') {
    const repos = await githubFetch('/user/repos?per_page=50&sort=updated&affiliation=owner,collaborator,organization_member');
    return repos.map((repo: any) => ({
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      defaultBranch: repo.default_branch,
      language: repo.language,
      url: repo.html_url,
    }));
  }
  if (name === 'get_repository_tree') {
    const parsed = repoParams.safeParse(args);
    if (!parsed.success) throw new Error('Invalid owner or repository name.');
    const { owner, repo } = parsed.data;
    const metadata = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const branch = typeof args.branch === 'string' ? args.branch : metadata.default_branch;
    if (branch.length > 200 || branch.includes('..')) throw new Error('Invalid branch name.');
    const tree = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    return {
      repository: metadata.full_name,
      branch,
      truncated: Boolean(tree.truncated),
      files: (tree.tree || []).filter((entry: any) => entry.type === 'blob').slice(0, 300).map((entry: any) => entry.path),
    };
  }
  if (name === 'read_repository_file') {
    const parsed = fileParams.safeParse(args);
    if (!parsed.success) throw new Error('Invalid repository file path.');
    const { owner, repo, path } = parsed.data;
    const file = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`);
    if (Array.isArray(file) || file.type !== 'file' || file.size > 100_000 || !file.content) {
      throw new Error('Unsupported file or file exceeds the 100 KB limit.');
    }
    return { path: file.path, content: Buffer.from(file.content, 'base64').toString('utf8') };
  }
  throw new Error('Unknown or disallowed tool. Only allowlisted repository inspection and proposal tools are enabled.');
}
