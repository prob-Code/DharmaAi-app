import type { DomainDiscoveryState } from './domainDiscovery';
import type { UserTimeBudget } from './conversationState';
import {
  startSession,
  type SessionOrchestratorState,
} from './sessionOrchestrator';

export function startSessionOne(
  state: SessionOrchestratorState,
  domainDiscovery: DomainDiscoveryState,
  baselineAssessmentComplete: boolean,
  participantAvailableTime: UserTimeBudget,
): SessionOrchestratorState | null {
  if (
    state.currentSessionNumber !== 1 ||
    state.sessionPhase !== 'NOT_STARTED' ||
    domainDiscovery.status !== 'CONFIRMED' ||
    domainDiscovery.participantConfirmation !== 'CONFIRMED' ||
    !domainDiscovery.isDiscoveryComplete ||
    domainDiscovery.fixedResearchDomain === null ||
    !baselineAssessmentComplete
  ) {
    return null;
  }

  return startSession(state, participantAvailableTime);
}
