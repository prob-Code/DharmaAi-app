import type { DomainDiscoveryState } from './domainDiscovery';
import type { UserTimeBudget } from './conversationState';
import {
  startSessionOne,
} from './researchLifecycle';
import type { SessionOrchestratorState } from './sessionOrchestrator';

export type ResearchWorkflowPhase =
  | 'NOT_STARTED'
  | 'DOMAIN_DISCOVERY'
  | 'DOMAIN_CONFIRMED'
  | 'BASELINE_PENDING'
  | 'BASELINE_COMPLETED'
  | 'SESSION_1_STARTED';

export interface ResearchWorkflowState {
  phase: ResearchWorkflowPhase;
  domainDiscovery: DomainDiscoveryState;
  baselineAssessmentComplete: boolean;
  sessionState: SessionOrchestratorState;
}

function hasConfirmedResearchDomain(
  domainDiscovery: DomainDiscoveryState,
): boolean {
  return (
    domainDiscovery.status === 'CONFIRMED' &&
    domainDiscovery.participantConfirmation === 'CONFIRMED' &&
    domainDiscovery.isDiscoveryComplete &&
    domainDiscovery.fixedResearchDomain !== null
  );
}

export function createInitialResearchWorkflowState(
  sessionState: SessionOrchestratorState,
  domainDiscovery: DomainDiscoveryState,
): ResearchWorkflowState {
  return {
    phase: 'NOT_STARTED',
    domainDiscovery,
    baselineAssessmentComplete: false,
    sessionState,
  };
}

export function beginResearchWorkflow(
  state: ResearchWorkflowState,
): ResearchWorkflowState | null {
  if (state.phase !== 'NOT_STARTED') {
    return null;
  }

  return {
    ...state,
    phase: 'DOMAIN_DISCOVERY',
  };
}

export function confirmResearchDomain(
  state: ResearchWorkflowState,
  domainDiscovery: DomainDiscoveryState,
): ResearchWorkflowState | null {
  if (state.phase !== 'DOMAIN_DISCOVERY' || !hasConfirmedResearchDomain(domainDiscovery)) {
    return null;
  }

  return {
    ...state,
    phase: 'DOMAIN_CONFIRMED',
    domainDiscovery,
  };
}

export function beginBaselineAssessment(
  state: ResearchWorkflowState,
): ResearchWorkflowState | null {
  if (state.phase !== 'DOMAIN_CONFIRMED') {
    return null;
  }

  return {
    ...state,
    phase: 'BASELINE_PENDING',
  };
}

export function completeBaselineAssessment(
  state: ResearchWorkflowState,
): ResearchWorkflowState | null {
  if (state.phase !== 'BASELINE_PENDING') {
    return null;
  }

  return {
    ...state,
    phase: 'BASELINE_COMPLETED',
    baselineAssessmentComplete: true,
  };
}

export function startResearchSessionOne(
  state: ResearchWorkflowState,
  participantAvailableTime: UserTimeBudget,
): ResearchWorkflowState | null {
  if (state.phase !== 'BASELINE_COMPLETED' || !state.baselineAssessmentComplete) {
    return null;
  }

  const nextSessionState = startSessionOne(
    state.sessionState,
    state.domainDiscovery,
    state.baselineAssessmentComplete,
    participantAvailableTime,
  );

  if (nextSessionState === null) {
    return null;
  }

  return {
    ...state,
    phase: 'SESSION_1_STARTED',
    sessionState: nextSessionState,
  };
}
