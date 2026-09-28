export interface ParagraphProductionGate {
  readonly userApproved: boolean;
  readonly supportedInterfacePinned: boolean;
  readonly createVerified: boolean;
  readonly updateVerified: boolean;
  readonly publishAndCanonicalDateVerified: boolean;
  readonly retryProtectionVerified: boolean;
  readonly publicReadVerified: boolean;
}

export function assertParagraphProductionGate(gate: ParagraphProductionGate): void {
  for (const prerequisite of Object.keys(gate) as (keyof ParagraphProductionGate)[]) {
    if (!gate[prerequisite]) throw new Error(`PARAGRAPH_PRODUCTION_GATE_BLOCKED:${prerequisite}`);
  }
}

export const currentParagraphProductionGate: ParagraphProductionGate = {
  userApproved: false,
  supportedInterfacePinned: false,
  createVerified: false,
  updateVerified: false,
  publishAndCanonicalDateVerified: false,
  retryProtectionVerified: false,
  publicReadVerified: false,
};

export const paragraphControlledCohortEvidence = Object.freeze({
  approvedOn: '2026-09-28',
  newsletterAuthorized: false,
  interfaceKind: 'rest',
  openapiCommit: '56c2fd279cfad810dab400236773406e41080d65',
  publicationId: 'SPY00S79M8L8PcefMZPC',
  publicationSlug: 'gcake',
  postSlug: 'gcake-cms-production-gate-20260928',
  remoteId: 'ZbxGX7Ju1uXR9BkSTj0R',
  remoteUrl: 'https://paragraph.com/@gcake/gcake-cms-production-gate-20260928',
  verifiedSourceRevision: 'sha256:095615f1e6961e53241bb698a313b255f4da1aa1d2677c4a5f59037d77d4e644',
  verifiedAt: '2026-09-28T10:47:05.727Z',
});

export function controlledCohortGate(publicationSlug: string, postSlug: string): ParagraphProductionGate {
  const authorized = publicationSlug === paragraphControlledCohortEvidence.publicationSlug
    && postSlug === paragraphControlledCohortEvidence.postSlug;
  return {
    userApproved: authorized,
    supportedInterfacePinned: authorized,
    createVerified: authorized,
    updateVerified: authorized,
    publishAndCanonicalDateVerified: authorized,
    retryProtectionVerified: authorized,
    publicReadVerified: authorized,
  };
}
