import type { ConversationState, UserTimeBudget } from './conversationState';
import { DEFAULT_CONVERSATION_STATE } from './conversationState';
import { createInitialSessionSummary, type SessionSummary } from './sessionSummary';

export const SESSION_NUMBERS = [1, 2, 3] as const;
export type InterventionSessionNumber = (typeof SESSION_NUMBERS)[number];

export type SessionPhase = 'NOT_STARTED' | 'OPENING' | 'ACTIVE' | 'CLOSING' | 'COMPLETED';

export const SESSION_PURPOSES: Record<InterventionSessionNumber, string> = {
  1: 'Open + Understand',
  2: 'Revisit + Dwell + Explore',
  3: 'Review + Resolve + Consolidate',
};

export interface SessionOrchestratorState {
  currentSessionNumber: InterventionSessionNumber;
  sessionPhase: SessionPhase;
  sessionObjective: string;
  conversationState: ConversationState;
  activeSummary: SessionSummary | null;
}

export const DEFAULT_SESSION_ORCHESTRATOR_STATE: SessionOrchestratorState = {
  currentSessionNumber: 1,
  sessionPhase: 'NOT_STARTED',
  sessionObjective: SESSION_PURPOSES[1],
  conversationState: DEFAULT_CONVERSATION_STATE,
  activeSummary: null,
};

export function isValidSessionNumber(
  value: number,
): value is InterventionSessionNumber {
  return SESSION_NUMBERS.includes(value as InterventionSessionNumber);
}

export function getSessionObjective(
  sessionNumber: number,
): string {
  return isValidSessionNumber(sessionNumber)
    ? SESSION_PURPOSES[sessionNumber]
    : 'Session not available';
}

export function canStartSession(
  targetSessionNumber: number,
  previousCompletedSessionNumber: number | null,
): boolean {
  if (!isValidSessionNumber(targetSessionNumber)) {
    return false;
  }

  if (targetSessionNumber === 1) {
    return true;
  }

  if (targetSessionNumber === 2) {
    return previousCompletedSessionNumber === 1;
  }

  if (targetSessionNumber === 3) {
    return previousCompletedSessionNumber === 2;
  }

  return false;
}

export function createSessionOrchestratorState(
  sessionNumber: number,
  previousCompletedSessionNumber: number | null,
  previousConversationState: ConversationState | null = null,
  overrides: Partial<SessionOrchestratorState> = {},
): SessionOrchestratorState | null {
  if (!canStartSession(sessionNumber, previousCompletedSessionNumber)) {
    return null;
  }

  const normalizedSessionNumber = sessionNumber as InterventionSessionNumber;

  if (normalizedSessionNumber > 1) {
    if (previousConversationState === null) {
      return null;
    }

    if (previousConversationState.sessionNumber !== previousCompletedSessionNumber) {
      return null;
    }

    if (previousConversationState.researchDomain === null) {
      return null;
    }
  }

  const previousResearchDomain = previousConversationState?.researchDomain ?? null;
  const sessionOneExplicitResearchDomain =
    overrides.conversationState?.researchDomain ?? DEFAULT_CONVERSATION_STATE.researchDomain;

  const authoritativeResearchDomain =
    normalizedSessionNumber === 1
      ? sessionOneExplicitResearchDomain
      : previousResearchDomain;

  const baseConversationState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ...previousConversationState,
    sessionNumber: normalizedSessionNumber,
    researchDomain: authoritativeResearchDomain,
    currentTopic: DEFAULT_CONVERSATION_STATE.currentTopic,
  };

  return {
    ...DEFAULT_SESSION_ORCHESTRATOR_STATE,
    ...overrides,
    currentSessionNumber: normalizedSessionNumber,
    sessionPhase: 'NOT_STARTED',
    sessionObjective: getSessionObjective(normalizedSessionNumber),
    activeSummary: null,
    conversationState: {
      ...baseConversationState,
      ...overrides.conversationState,
      sessionNumber: normalizedSessionNumber,
      researchDomain: authoritativeResearchDomain,
      currentTopic: DEFAULT_CONVERSATION_STATE.currentTopic,
    },
  };
}

export function startSession(
  state: SessionOrchestratorState,
  participantAvailableTime: UserTimeBudget,
): SessionOrchestratorState {
  if (!isValidSessionNumber(state.currentSessionNumber)) {
    return state;
  }

  if (state.sessionPhase !== 'NOT_STARTED') {
    return state;
  }

  return {
    ...state,
    conversationState: {
      ...state.conversationState,
      sessionNumber: state.currentSessionNumber,
      userTimeBudget: participantAvailableTime,
    },
    sessionPhase: 'OPENING',
    sessionObjective: getSessionObjective(state.currentSessionNumber),
  };
}

export function advanceSession(
  state: SessionOrchestratorState,
): SessionOrchestratorState {
  if (!isValidSessionNumber(state.currentSessionNumber)) {
    return state;
  }

  if (state.sessionPhase !== 'OPENING') {
    return state;
  }

  return {
    ...state,
    sessionPhase: 'ACTIVE',
    conversationState: {
      ...state.conversationState,
      sessionNumber: state.currentSessionNumber,
    },
  };
}

export function beginClosure(
  state: SessionOrchestratorState,
): SessionOrchestratorState {
  if (!isValidSessionNumber(state.currentSessionNumber)) {
    return state;
  }

  if (state.sessionPhase !== 'ACTIVE') {
    return state;
  }

  return {
    ...state,
    sessionPhase: 'CLOSING',
    conversationState: {
      ...state.conversationState,
      sessionNumber: state.currentSessionNumber,
    },
  };
}

export function closeSession(
  state: SessionOrchestratorState,
  summaryOverrides: Partial<SessionSummary> = {},
): SessionOrchestratorState {
  if (!isValidSessionNumber(state.currentSessionNumber)) {
    return state;
  }

  if (state.sessionPhase !== 'CLOSING') {
    return state;
  }

  const summary: SessionSummary = createInitialSessionSummary({
    ...summaryOverrides,
    sessionNumber: state.currentSessionNumber,
    researchDomain: state.conversationState.researchDomain,
  });

  return {
    ...state,
    sessionPhase: 'COMPLETED',
    conversationState: {
      ...state.conversationState,
      sessionNumber: state.currentSessionNumber,
    },
    activeSummary: summary,
  };
}
