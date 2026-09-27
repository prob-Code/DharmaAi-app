export type ResearchDomain = string | null;

export const RESPONSE_DEPTHS = ['brief', 'balanced', 'deep'] as const;
export type ResponseDepth = (typeof RESPONSE_DEPTHS)[number];

export const USER_TIME_BUDGETS = ['brief', 'standard', 'extended'] as const;
export type UserTimeBudget = (typeof USER_TIME_BUDGETS)[number];

export const INTERACTION_MODES = ['conversation', 'quiet', 'reflection', 'activity'] as const;
export type InteractionMode = (typeof INTERACTION_MODES)[number];

export const ACTIVITY_MODES = ['none', 'gentle', 'reflective', 'active'] as const;
export type ActivityMode = (typeof ACTIVITY_MODES)[number];

export enum SafetyLevel {
  Standard = 0,
  ElevatedDistress = 1,
  SafetyConcern = 2,
  ImminentHighRiskConcern = 3,
}

export interface ConversationState {
  sessionNumber: number;
  researchDomain: ResearchDomain;
  currentTopic: string;
  responseDepth: ResponseDepth;
  userTimeBudget: UserTimeBudget;
  interactionMode: InteractionMode;
  openness: number;
  activityMode: ActivityMode;
  safetyLevel: SafetyLevel;
}

export const DEFAULT_CONVERSATION_STATE: ConversationState = {
  sessionNumber: 1,
  researchDomain: null,
  currentTopic: 'check-in',
  responseDepth: 'brief',
  userTimeBudget: 'standard',
  interactionMode: 'conversation',
  openness: 0.5,
  activityMode: 'none',
  safetyLevel: SafetyLevel.Standard,
};

export function createInitialConversationState(
  overrides: Partial<ConversationState> = {},
): ConversationState {
  return {
    ...DEFAULT_CONVERSATION_STATE,
    ...overrides,
  };
}

export function clampOpenness(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CONVERSATION_STATE.openness;
  }

  return Math.min(1, Math.max(0, value));
}

export function updateCurrentTopic(
  state: ConversationState,
  topic: string,
): ConversationState {
  const nextTopic = topic.trim();

  return {
    ...state,
    currentTopic: nextTopic.length > 0 ? nextTopic : state.currentTopic,
  };
}

export function updateResponseDepth(
  state: ConversationState,
  responseDepth: ResponseDepth,
): ConversationState {
  return {
    ...state,
    responseDepth,
  };
}

export function updateInteractionMode(
  state: ConversationState,
  interactionMode: InteractionMode,
): ConversationState {
  return {
    ...state,
    interactionMode,
  };
}

export function updateOpenness(
  state: ConversationState,
  openness: number,
): ConversationState {
  return {
    ...state,
    openness: clampOpenness(openness),
  };
}

export function advanceSessionNumber(
  state: ConversationState,
  amount: number = 1,
): ConversationState {
  const nextSessionNumber = Math.max(1, state.sessionNumber + amount);

  return {
    ...state,
    sessionNumber: nextSessionNumber,
  };
}
