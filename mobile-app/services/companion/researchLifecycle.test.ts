import {
  createInitialDomainDiscoveryState,
} from './domainDiscovery';
import { createInitialConversationState } from './conversationState';
import {
  beginClosure,
  closeSession,
  createSessionOrchestratorState,
  startSession,
} from './sessionOrchestrator';
import { startSessionOne } from './researchLifecycle';

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

function createConfirmedDiscoveryState() {
  return createInitialDomainDiscoveryState({
    status: 'CONFIRMED',
    participantConfirmation: 'CONFIRMED',
    isDiscoveryComplete: true,
    fixedResearchDomain: 'work-life balance',
  });
}

export function runResearchLifecycleTests(): void {
  const validResult = startSessionOne(
    createSessionOneState(),
    createConfirmedDiscoveryState(),
    true,
    'standard',
  );
  assert(validResult?.sessionPhase === 'OPENING', 'valid prerequisites should start Session 1');
  assert(validResult?.conversationState.userTimeBudget === 'standard', 'start should apply the participant time budget');

  assert(
    startSessionOne(
      createSessionOneState(),
      createInitialDomainDiscoveryState(),
      true,
      'standard',
    ) === null,
    'missing domain should block Session 1',
  );

  assert(
    startSessionOne(
      createSessionOneState(),
      createConfirmedDiscoveryState(),
      false,
      'standard',
    ) === null,
    'incomplete baseline should block Session 1',
  );

  const activeState = startSession(createSessionOneState(), 'standard');
  assert(
    startSessionOne(activeState, createConfirmedDiscoveryState(), true, 'extended') === null,
    'active Session 1 should not restart',
  );

  const closingState = beginClosure(activeState);
  const completedState = closeSession(closingState);
  assert(
    startSessionOne(completedState, createConfirmedDiscoveryState(), true, 'extended') === null,
    'completed Session 1 should not restart',
  );
}

runResearchLifecycleTests();
