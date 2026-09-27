import {
  DEFAULT_CONVERSATION_STATE,
  type ConversationState,
  type InteractionMode,
  type ResearchDomain,
  type ResponseDepth,
  type SafetyLevel,
  type UserTimeBudget,
} from './conversationState';
import {
  SESSION_NUMBERS,
  type InterventionSessionNumber,
  type SessionOrchestratorState,
  getSessionObjective,
} from './sessionOrchestrator';
import type { SessionSummary } from './sessionSummary';
import type { DomainDiscoveryState } from './domainDiscovery';

export type CompanionSessionSnapshot = Pick<
  SessionOrchestratorState,
  'currentSessionNumber' | 'sessionPhase' | 'sessionObjective'
>;

export interface CompanionContextDerived {
  readonly researchDomain: ResearchDomain;
  readonly currentTopic: string;
  readonly sessionNumber: number;
  readonly responseDepth: ResponseDepth;
  readonly userTimeBudget: UserTimeBudget;
  readonly interactionMode: InteractionMode;
  readonly openness: number;
  readonly safetyLevel: SafetyLevel;
}

export interface CompanionContext {
  currentUserMessage: string;
  conversation: ConversationState;
  session: CompanionSessionSnapshot;
  activeSummary: SessionSummary | null;
  domainDiscovery: DomainDiscoveryState | null;
  derived: CompanionContextDerived;
}

function normalizeSessionNumber(value: number): InterventionSessionNumber {
  return SESSION_NUMBERS.includes(value as InterventionSessionNumber)
    ? (value as InterventionSessionNumber)
    : 1;
}

export function createCompanionContextDerived(
  conversation: ConversationState,
): CompanionContextDerived {
  return {
    researchDomain: conversation.researchDomain,
    currentTopic: conversation.currentTopic,
    sessionNumber: conversation.sessionNumber,
    responseDepth: conversation.responseDepth,
    userTimeBudget: conversation.userTimeBudget,
    interactionMode: conversation.interactionMode,
    openness: conversation.openness,
    safetyLevel: conversation.safetyLevel,
  };
}

export function getCompanionContextSessionSnapshot(
  state: SessionOrchestratorState,
): CompanionSessionSnapshot {
  return {
    currentSessionNumber: state.currentSessionNumber,
    sessionPhase: state.sessionPhase,
    sessionObjective: state.sessionObjective,
  };
}

function resolveConversationAndSession(
  conversation: ConversationState,
  sessionState: SessionOrchestratorState | null,
): {
  conversation: ConversationState;
  session: CompanionSessionSnapshot;
} {
  const authoritativeSession = sessionState ?? null;

  const normalizedConversation: ConversationState = authoritativeSession
    ? {
        ...conversation,
        sessionNumber: authoritativeSession.currentSessionNumber,
      }
    : conversation;

  const sessionSnapshot: CompanionSessionSnapshot = authoritativeSession
    ? getCompanionContextSessionSnapshot(authoritativeSession)
    : {
        currentSessionNumber: normalizeSessionNumber(normalizedConversation.sessionNumber),
        sessionPhase: 'NOT_STARTED',
        sessionObjective: getSessionObjective(
          normalizeSessionNumber(normalizedConversation.sessionNumber),
        ),
      };

  return {
    conversation: normalizedConversation,
    session: sessionSnapshot,
  };
}

export function createCompanionContext(
  currentUserMessage: string = '',
  conversation: ConversationState = DEFAULT_CONVERSATION_STATE,
  sessionState: SessionOrchestratorState | null = null,
  options: {
    activeSummary?: SessionSummary | null;
    domainDiscovery?: DomainDiscoveryState | null;
  } = {},
): CompanionContext {
  const { conversation: normalizedConversation, session: normalizedSession } = resolveConversationAndSession(
    conversation,
    sessionState,
  );

  return {
    currentUserMessage,
    conversation: normalizedConversation,
    session: normalizedSession,
    activeSummary: options.activeSummary ?? null,
    domainDiscovery: options.domainDiscovery ?? null,
    derived: createCompanionContextDerived(normalizedConversation),
  };
}

export function updateCurrentUserMessage(
  context: CompanionContext,
  currentUserMessage: string,
): CompanionContext {
  return {
    ...context,
    currentUserMessage: currentUserMessage.trim(),
  };
}

export function updateCompanionContext(
  context: CompanionContext,
  updates: {
    currentUserMessage?: string;
    conversation?: Partial<ConversationState>;
    sessionState?: SessionOrchestratorState | null;
    activeSummary?: SessionSummary | null;
    domainDiscovery?: DomainDiscoveryState | null;
  } = {},
): CompanionContext {
  const nextConversation: ConversationState = {
    ...context.conversation,
    ...updates.conversation,
  };

  const authoritativeSessionState = updates.sessionState ?? null;
  const nextSessionState = authoritativeSessionState ?? {
    currentSessionNumber: context.session.currentSessionNumber,
    sessionPhase: context.session.sessionPhase,
    sessionObjective: context.session.sessionObjective,
    conversationState: context.conversation,
    activeSummary: context.activeSummary,
  };

  const { conversation: normalizedConversation, session: normalizedSession } = resolveConversationAndSession(
    nextConversation,
    authoritativeSessionState ?? nextSessionState,
  );

  return createCompanionContext(
    updates.currentUserMessage ?? context.currentUserMessage,
    normalizedConversation,
    authoritativeSessionState ?? nextSessionState,
    {
      activeSummary: updates.activeSummary ?? context.activeSummary,
      domainDiscovery: updates.domainDiscovery ?? context.domainDiscovery,
    },
  );
}
