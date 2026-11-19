import { Router } from 'express';
import { z } from 'zod';
import { config } from './config';

export const githubRouter = Router();

const repositoryName = z.string().regex(/^[A-Za-z0-9_.-]+$/);
const ownerName = z.string().regex(/^[A-Za-z0-9-]+$/);
const repoParams = z.object({ owner: ownerName, repo: repositoryName });
const fileParams = repoParams.extend({
  path: z.string().min(1).max(500).refine((value) => !value.startsWith('/') && !value.split('/').includes('..'), 'Invalid repository path'),
});

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
