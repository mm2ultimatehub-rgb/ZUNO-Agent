import { beforeEach, describe, expect, it } from 'vitest';
import { createProposal, getProposal, markProposalApproved } from './proposals';

describe('change proposal lifecycle', () => {
  let proposalId = '';

  beforeEach(() => {
    const proposal = createProposal({
      owner: 'zuno-test',
      repo: 'sample',
      path: 'src/example.ts',
      summary: 'Add a small example',
      baseBranch: 'main',
      baseSha: 'base-sha',
      originalSha: null,
      originalContent: '',
      proposedContent: 'export const value = 1;',
    });
    proposalId = proposal.id;
  });

  it('stores a proposal as pending and makes it retrievable', () => {
    const proposal = getProposal(proposalId);
    expect(proposal?.status).toBe('pending');
    expect(proposal?.path).toBe('src/example.ts');
  });

  it('does not return a proposal after approval', () => {
    markProposalApproved(proposalId);
    expect(getProposal(proposalId)).toBeUndefined();
  });

  it('returns no proposal for an unknown identifier', () => {
    expect(getProposal('00000000-0000-4000-8000-000000000000')).toBeUndefined();
  });
});
