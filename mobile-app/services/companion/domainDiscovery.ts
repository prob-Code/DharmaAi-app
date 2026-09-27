import type { ResearchDomain } from './conversationState';

export type DomainDiscoveryStatus =
  | 'NOT_STARTED'
  | 'EXPLORING'
  | 'CANDIDATE_PRESENTED'
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'REJECTED';

export type ParticipantConfirmationState = 'UNSET' | 'CONFIRMED' | 'REJECTED';

export interface DomainDiscoveryState {
  status: DomainDiscoveryStatus;
  currentCandidateDomain: ResearchDomain;
  participantConfirmation: ParticipantConfirmationState;
  participantFacingScenario: string;
  isDiscoveryComplete: boolean;
  fixedResearchDomain: ResearchDomain;
}

export const DEFAULT_DOMAIN_DISCOVERY_STATE: DomainDiscoveryState = {
  status: 'NOT_STARTED',
  currentCandidateDomain: null,
  participantConfirmation: 'UNSET',
  participantFacingScenario: '',
  isDiscoveryComplete: false,
  fixedResearchDomain: null,
};

export function createInitialDomainDiscoveryState(
  overrides: Partial<DomainDiscoveryState> = {},
): DomainDiscoveryState {
  return {
    ...DEFAULT_DOMAIN_DISCOVERY_STATE,
    ...overrides,
  };
}

export function beginDomainDiscovery(
  state: DomainDiscoveryState,
): DomainDiscoveryState {
  if (state.status === 'CONFIRMED') {
    return state;
  }

  return {
    ...state,
    status: 'EXPLORING',
    currentCandidateDomain: null,
    participantConfirmation: 'UNSET',
    participantFacingScenario: '',
    isDiscoveryComplete: false,
  };
}

export function setCandidateDomain(
  state: DomainDiscoveryState,
  candidateDomain: ResearchDomain,
  participantScenario: string,
): DomainDiscoveryState {
  if (state.status === 'CONFIRMED') {
    return state;
  }

  const nextScenario = participantScenario.trim();

  return {
    ...state,
    currentCandidateDomain: candidateDomain,
    participantFacingScenario: nextScenario,
    participantConfirmation: 'UNSET',
    status: candidateDomain === null ? 'EXPLORING' : 'CANDIDATE_PRESENTED',
    isDiscoveryComplete: false,
  };
}

export function presentCandidateForConfirmation(
  state: DomainDiscoveryState,
): DomainDiscoveryState {
  if (state.status === 'CONFIRMED' || state.currentCandidateDomain === null) {
    return state;
  }

  return {
    ...state,
    status: 'AWAITING_CONFIRMATION',
    participantConfirmation: 'UNSET',
    isDiscoveryComplete: false,
  };
}

export function confirmCandidateDomain(
  state: DomainDiscoveryState,
): DomainDiscoveryState {
  if (state.status === 'CONFIRMED') {
    return state;
  }

  if (state.currentCandidateDomain === null) {
    return state;
  }

  return {
    ...state,
    status: 'CONFIRMED',
    participantConfirmation: 'CONFIRMED',
    fixedResearchDomain: state.currentCandidateDomain,
    isDiscoveryComplete: true,
  };
}

export function rejectCandidateDomain(
  state: DomainDiscoveryState,
): DomainDiscoveryState {
  if (state.status === 'CONFIRMED') {
    return state;
  }

  return {
    ...state,
    status: 'REJECTED',
    participantConfirmation: 'REJECTED',
    currentCandidateDomain: null,
    participantFacingScenario: '',
    isDiscoveryComplete: false,
  };
}

export function retryDomainDiscovery(
  state: DomainDiscoveryState,
): DomainDiscoveryState {
  if (state.status === 'CONFIRMED') {
    return state;
  }

  return {
    ...state,
    status: 'EXPLORING',
    currentCandidateDomain: null,
    participantConfirmation: 'UNSET',
    participantFacingScenario: '',
    isDiscoveryComplete: false,
  };
}
