import {
  confirmCandidateDomain,
  createInitialDomainDiscoveryState,
  setCandidateDomain,
} from './domainDiscovery';
import { createInitialConversationState } from './conversationState';
import { createSessionOrchestratorState, startSession } from './sessionOrchestrator';
import {
  beginBaselineAssessment,
  beginResearchWorkflow,
  completeBaselineAssessment,
  confirmResearchDomain,
  createInitialResearchWorkflowState,
  startResearchSessionOne,
  type BaselineAssessmentRecord,
} from './researchWorkflow';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createSessionOneState() {
  const conversationState = createInitialConversationState({
    researchDomain: 'work-life balance',
  });
  const state = createSessionOrchestratorState(1, null, conversationState, {
    conversationState,
  });

  if (state === null) {
    throw new Error('Expected Session 1 state to be created');
  }

  return state;
}

function createConfirmedDomainDiscoveryState() {
  const candidateState = setCandidateDomain(
    createInitialDomainDiscoveryState(),
    'work-life balance',
    'Work and personal responsibilities feel difficult to balance.',
  );

  return confirmCandidateDomain(candidateState);
}

function createBaselineRecord(): BaselineAssessmentRecord {
  return {
    instrumentId: 'baseline-pre',
    instrumentVersion: 'v1',
    researchDomain: 'work-life balance',
    completedAt: '2026-09-15T00:00:00.000Z',
    role: 'pre',
  };
}

export function runResearchWorkflowTests(): void {
  const workflowStart = createInitialResearchWorkflowState();
  const begun = beginResearchWorkflow(workflowStart);
  assert(begun?.phase === 'DOMAIN_DISCOVERY', 'workflow should begin in domain discovery');

  const invalidDomain = confirmResearchDomain(
    begun!,
    createInitialDomainDiscoveryState(),
  );
  assert(invalidDomain === null, 'invalid domain confirmation should be blocked');

  const validConfirmedDomain = createConfirmedDomainDiscoveryState();
  const domainConfirmed = confirmResearchDomain(begun!, validConfirmedDomain);
  assert(domainConfirmed?.phase === 'DOMAIN_CONFIRMED', 'valid domain confirmation should advance workflow');
  assert(domainConfirmed?.confirmedResearchDomain === 'work-life balance', 'confirmed domain should freeze by value');

  const changedDomain = createConfirmedDomainDiscoveryState();
  const changedDomainAttempt = confirmResearchDomain(
    domainConfirmed!,
    {
      ...changedDomain,
      fixedResearchDomain: 'different domain',
    },
  );
  assert(changedDomainAttempt === null, 'confirmed domain should not change after confirmation');

  const baselineBeforeDomain = completeBaselineAssessment(
    domainConfirmed!,
    createBaselineRecord(),
  );
  assert(baselineBeforeDomain === null, 'baseline must be blocked before baseline assessment begins');

  const baselinePending = beginBaselineAssessment(domainConfirmed!);
  assert(baselinePending?.phase === 'BASELINE_PENDING', 'baseline should become pending after domain confirmation');

  const validBaseline = completeBaselineAssessment(
    baselinePending!,
    createBaselineRecord(),
  );
  assert(validBaseline?.phase === 'BASELINE_COMPLETED', 'valid baseline record should advance workflow');
  assert(validBaseline?.baselineAssessment?.researchDomain === 'work-life balance', 'baseline record should carry the frozen research domain');

  const sessionStarted = startResearchSessionOne(
    validBaseline!,
    createSessionOneState(),
    'standard',
  );
  assert(sessionStarted?.workflowState.phase === 'SESSIONS_ACTIVE', 'Session 1 should start only after valid baseline');
  assert(sessionStarted?.sessionState.sessionPhase === 'OPENING', 'Session 1 should enter the OPENING phase');

  assert(
  startResearchSessionOne(
    validBaseline!,
    sessionStarted!.sessionState,
    'extended',
  ) === null,
  'Session 1 should not start twice',
  );

  const activeState = startSession(createSessionOneState(), 'standard');
  assert(
    startResearchSessionOne(validBaseline!, activeState, 'standard') === null,
    'already active session should block restart',
  );
}

runResearchWorkflowTests();
