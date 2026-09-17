import type { DomainDiscoveryState } from './domainDiscovery';
import type { UserTimeBudget } from './conversationState';
import { startSession, type SessionOrchestratorState } from './sessionOrchestrator';

export type ResearchWorkflowPhase =
  | 'NOT_STARTED'
  | 'DOMAIN_DISCOVERY'
  | 'DOMAIN_CONFIRMED'
  | 'BASELINE_PENDING'
  | 'BASELINE_COMPLETED'
  | 'SESSIONS_ACTIVE';

export interface BaselineAssessmentRecord {
  instrumentId: string;
  instrumentVersion: string;
  researchDomain: string;
  completedAt: string;
  role: 'pre';
}

export interface ResearchWorkflowState {
  phase: ResearchWorkflowPhase;
  confirmedResearchDomain: string | null;
  baselineAssessment: BaselineAssessmentRecord | null;
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

export function createInitialResearchWorkflowState(): ResearchWorkflowState {
  return {
    phase: 'NOT_STARTED',
    confirmedResearchDomain: null,
    baselineAssessment: null,
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
  if (
    state.phase !== 'DOMAIN_DISCOVERY' ||
    !hasConfirmedResearchDomain(domainDiscovery) ||
    (state.confirmedResearchDomain !== null && state.confirmedResearchDomain !== domainDiscovery.fixedResearchDomain)
  ) {
    return null;
  }

  return {
    ...state,
    phase: 'DOMAIN_CONFIRMED',
    confirmedResearchDomain: domainDiscovery.fixedResearchDomain,
  };
}

export function beginBaselineAssessment(
  state: ResearchWorkflowState,
): ResearchWorkflowState | null {
  if (state.phase !== 'DOMAIN_CONFIRMED' || state.confirmedResearchDomain === null) {
    return null;
  }

  return {
    ...state,
    phase: 'BASELINE_PENDING',
  };
}

export function completeBaselineAssessment(
  state: ResearchWorkflowState,
  baselineAssessment: BaselineAssessmentRecord,
): ResearchWorkflowState | null {
  if (
    state.phase !== 'BASELINE_PENDING' ||
    state.confirmedResearchDomain === null ||
    baselineAssessment.role !== 'pre' ||
    baselineAssessment.researchDomain !== state.confirmedResearchDomain
  ) {
    return null;
  }

  return {
    ...state,
    phase: 'BASELINE_COMPLETED',
    baselineAssessment,
  };
}

export function startResearchSessionOne(
  state: ResearchWorkflowState,
  sessionState: SessionOrchestratorState,
  participantAvailableTime: UserTimeBudget,
): { workflowState: ResearchWorkflowState; sessionState: SessionOrchestratorState } | null {
  if (
    state.phase !== 'BASELINE_COMPLETED' ||
    state.confirmedResearchDomain === null ||
    state.baselineAssessment === null ||
    state.baselineAssessment.researchDomain !== state.confirmedResearchDomain ||
    state.baselineAssessment.role !== 'pre' ||
    sessionState.currentSessionNumber !== 1 ||
    sessionState.sessionPhase !== 'NOT_STARTED'
  ) {
    return null;
  }

  const nextSessionState = startSession(sessionState, participantAvailableTime);

  if (nextSessionState.sessionPhase !== 'OPENING') {
    return null;
  }

  return {
    workflowState: {
      ...state,
      phase: 'SESSIONS_ACTIVE',
    },
    sessionState: nextSessionState,
  };
}
