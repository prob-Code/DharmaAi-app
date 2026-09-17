import {
  createInitialDomainDiscoveryState,
  confirmCandidateDomain,
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
} from './researchWorkflow';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createSessionOneState() {
  const conversationState = createInitialConversationState();
  const state = createSessionOrchestratorState(1, null, conversationState, {
    conversationState,
  });

  if (state === null) {
    throw new Error('Expected Session 1 state to be created');
  }

  return state;
}

function createWorkflowState() {
  return createInitialResearchWorkflowState(
    createSessionOneState(),
    createInitialDomainDiscoveryState(),
  );
}

function createConfirmedDomainDiscoveryState() {
  const candidateState = setCandidateDomain(
    createInitialDomainDiscoveryState(),
    'work-life balance',
    'Work and personal responsibilities feel difficult to balance.',
  );

  return confirmCandidateDomain(candidateState);
}

function confirmDomainAndBeginBaseline() {
  const started = beginResearchWorkflow(createWorkflowState());
  if (started === null) {
    throw new Error('Expected research workflow to begin');
  }

  const domainConfirmed = confirmResearchDomain(
    started,
    createConfirmedDomainDiscoveryState(),
  );
  if (domainConfirmed === null) {
    throw new Error('Expected domain confirmation to succeed');
  }

  const baselinePending = beginBaselineAssessment(domainConfirmed);
  if (baselinePending === null) {
    throw new Error('Expected baseline assessment to begin');
  }

  return baselinePending;
}

export function runResearchWorkflowTests(): void {
  const begun = beginResearchWorkflow(createWorkflowState());
  assert(begun?.phase === 'DOMAIN_DISCOVERY', 'workflow should begin in domain discovery');

  const invalidDomain = confirmResearchDomain(
    begun!,
    createInitialDomainDiscoveryState(),
  );
  assert(invalidDomain === null, 'unconfirmed domain should not advance workflow');

  const domainConfirmed = confirmResearchDomain(
    begun!,
    createConfirmedDomainDiscoveryState(),
  );
  assert(domainConfirmed?.phase === 'DOMAIN_CONFIRMED', 'confirmed domain should advance workflow');

  assert(
    completeBaselineAssessment(domainConfirmed!) === null,
    'baseline should not complete before baseline assessment begins',
  );

  const baselinePending = beginBaselineAssessment(domainConfirmed!);
  assert(baselinePending?.phase === 'BASELINE_PENDING', 'baseline should become pending');

  const baselineCompleted = completeBaselineAssessment(baselinePending!);
  assert(baselineCompleted?.phase === 'BASELINE_COMPLETED', 'completed baseline should advance workflow');

  const sessionStarted = startResearchSessionOne(baselineCompleted!, 'standard');
  assert(sessionStarted?.phase === 'SESSION_1_STARTED', 'both prerequisites should start Session 1');
  assert(sessionStarted?.sessionState.sessionPhase === 'OPENING', 'Session 1 should enter OPENING');

  assert(
    startResearchSessionOne(sessionStarted!, 'extended') === null,
    'Session 1 should not start twice',
  );

  assert(
  beginResearchWorkflow(begun!) === null,
  'workflow should not begin twice',
  );
  assert(
    confirmResearchDomain(createWorkflowState(), createConfirmedDomainDiscoveryState()) === null,
    'domain confirmation should not skip workflow start',
  );

  const activeState = startSession(createSessionOneState(), 'standard');
  const activeWorkflow = {
    ...baselineCompleted!,
    sessionState: activeState,
  };
  assert(
    startResearchSessionOne(activeWorkflow, 'standard') === null,
    'active Session 1 should block a restart',
  );
}

runResearchWorkflowTests();
