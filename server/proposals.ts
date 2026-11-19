import { randomUUID } from 'node:crypto';

export interface PendingProposal {
  id: string;
  owner: string;
  repo: string;
  path: string;
  summary: string;
  baseBranch: string;
  baseSha: string;
  originalSha: string | null;
  originalContent: string;
  proposedContent: string;
  createdAt: number;
  status: 'pending' | 'approved';
}

const proposals = new Map<string, PendingProposal>();

export function createProposal(input: Omit<PendingProposal, 'id' | 'createdAt' | 'status'>): PendingProposal {
  const proposal: PendingProposal = {
    ...input,
    id: randomUUID(),
    createdAt: Date.now(),
    status: 'pending',
  };
  proposals.set(proposal.id, proposal);
  return proposal;
}

export function getProposal(id: string): PendingProposal | undefined {
  const proposal = proposals.get(id);
  if (!proposal || proposal.status !== 'pending') return undefined;
  if (Date.now() - proposal.createdAt > 60 * 60 * 1000) {
    proposals.delete(id);
    return undefined;
  }
  return proposal;
}

export function markProposalApproved(id: string): void {
  const proposal = proposals.get(id);
  if (proposal) proposal.status = 'approved';
}
