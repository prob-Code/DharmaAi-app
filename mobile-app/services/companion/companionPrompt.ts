import type { CompanionContext } from './companionContext';
import {
  type InteractionMode,
  type ResponseDepth,
  type SafetyLevel,
  type UserTimeBudget,
} from './conversationState';

export interface CompanionPromptBehavior {
  readonly defaultResponseDepth: ResponseDepth;
  readonly userSpeaksMoreThanCompanion: boolean;
  readonly preferShortDialogue: boolean;
  readonly listenBeforeResponding: boolean;
  readonly doNotInterruptUnnecessarily: boolean;
  readonly respectPauses: boolean;
  readonly adaptToExplicitDepthRequest: boolean;
  readonly followCurrentTopic: boolean;
  readonly keepResearchDomainBackground: boolean;
  readonly doNotForceGitaWisdom: boolean;
  readonly doNotDiagnoseOrCure: boolean;
  readonly doNotMakeConsequentialLifeDecisions: boolean;
  readonly doNotEncourageDependence: boolean;
  readonly safetyLevelIsStructuralOnly: boolean;
}

export interface CompanionPromptContext {
  readonly sessionNumber: number;
  readonly currentTopic: string;
  readonly researchDomain: string | null;
  readonly responseDepth: ResponseDepth;
  readonly userTimeBudget: UserTimeBudget;
  readonly interactionMode: InteractionMode;
  readonly openness: number;
  readonly safetyLevel: SafetyLevel;
  readonly sessionPhase: string;
  readonly sessionObjective: string;
  readonly hasSummary: boolean;
  readonly hasDomainDiscovery: boolean;
}

export interface CompanionPromptPayload {
  readonly systemBehavior: CompanionPromptBehavior;
  readonly context: CompanionPromptContext;
  readonly userMessage: string;
}

export function createCompanionPromptBehavior(): CompanionPromptBehavior {
  return {
    defaultResponseDepth: 'brief',
    userSpeaksMoreThanCompanion: true,
    preferShortDialogue: true,
    listenBeforeResponding: true,
    doNotInterruptUnnecessarily: true,
    respectPauses: true,
    adaptToExplicitDepthRequest: true,
    followCurrentTopic: true,
    keepResearchDomainBackground: true,
    doNotForceGitaWisdom: true,
    doNotDiagnoseOrCure: true,
    doNotMakeConsequentialLifeDecisions: true,
    doNotEncourageDependence: true,
    safetyLevelIsStructuralOnly: true,
  };
}

export function createCompanionPromptContext(
  context: CompanionContext,
): CompanionPromptContext {
  return {
    sessionNumber: context.derived.sessionNumber,
    currentTopic: context.derived.currentTopic,
    researchDomain: context.derived.researchDomain,
    responseDepth: context.derived.responseDepth,
    userTimeBudget: context.derived.userTimeBudget,
    interactionMode: context.derived.interactionMode,
    openness: context.derived.openness,
    safetyLevel: context.derived.safetyLevel,
    sessionPhase: context.session.sessionPhase,
    sessionObjective: context.session.sessionObjective,
    hasSummary: context.activeSummary !== null,
    hasDomainDiscovery: context.domainDiscovery !== null,
  };
}

export function createCompanionPrompt(
  context: CompanionContext,
  userMessageOverride?: string,
): CompanionPromptPayload {
  const userMessage = (userMessageOverride ?? context.currentUserMessage).trim();

  return {
    systemBehavior: createCompanionPromptBehavior(),
    context: createCompanionPromptContext(context),
    userMessage,
  };
}
