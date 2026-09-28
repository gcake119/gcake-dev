import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertParagraphProductionGate,
  controlledCohortGate,
  currentParagraphProductionGate,
  paragraphControlledCohortEvidence,
  type ParagraphProductionGate,
} from './paragraph-gate';

const complete: ParagraphProductionGate = {
  userApproved: true,
  supportedInterfacePinned: true,
  createVerified: true,
  updateVerified: true,
  publishAndCanonicalDateVerified: true,
  retryProtectionVerified: true,
  publicReadVerified: true,
};

for (const prerequisite of Object.keys(complete) as (keyof ParagraphProductionGate)[]) {
  test(`Paragraph production gate fails closed when ${prerequisite} is missing`, () => {
    assert.throws(
      () => assertParagraphProductionGate({ ...complete, [prerequisite]: false }),
      (error: unknown) => error instanceof Error && error.message === `PARAGRAPH_PRODUCTION_GATE_BLOCKED:${prerequisite}`,
    );
  });
}

test('complete evidence receipt is the only state that opens the implementation gate', () => {
  assert.doesNotThrow(() => assertParagraphProductionGate(complete));
});

test('controlled evidence opens only the approved cohort while the global gate stays blocked', () => {
  assert.throws(() => assertParagraphProductionGate(currentParagraphProductionGate), /userApproved/);
  assert.doesNotThrow(() => assertParagraphProductionGate(controlledCohortGate('gcake', 'gcake-cms-production-gate-20260928')));
  assert.throws(() => assertParagraphProductionGate(controlledCohortGate('gcake', 'another-post')), /userApproved/);
  assert.equal(paragraphControlledCohortEvidence.newsletterAuthorized, false);
});
