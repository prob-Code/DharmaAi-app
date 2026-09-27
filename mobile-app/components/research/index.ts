// Participant research UI. Presentational surfaces only — the primary
// research controller / App wiring owns all state, callbacks, and protocol
// transitions.
export { AdssScreen } from './AdssScreen';
export { BaselineIntroScreen } from './BaselineIntroScreen';
export { CompletionScreen } from './CompletionScreen';
export { ConsentScreen } from './ConsentScreen';
export { DomainConfirmationScreen } from './DomainConfirmationScreen';
export { DomainDiscoveryScreen } from './DomainDiscoveryScreen';
export { FeedbackScreen, type FeedbackInput } from './FeedbackScreen';
export { NotEligibleScreen } from './NotEligibleScreen';
export { PostTestIntroScreen } from './PostTestIntroScreen';
export {
  QuestionnaireScreen,
  type QuestionnaireAnswers,
} from './QuestionnaireScreen';
export {
  createDefaultResearchActions,
  type ResearchActions,
} from './ResearchActions';
export {
  ResearchExperience,
  type ResearchExperienceProps,
} from './ResearchExperience';
export { ResearchIntroScreen } from './ResearchIntroScreen';
export {
  resolveParticipantStage,
  type ParticipantStage,
  type ResearchHydrationStatus,
} from './participantFlow';
export {
  resolveResearchGateStep,
  type ResearchGateStep,
} from '../../services/research/researchGate';
export { ScreeningPendingScreen } from './ScreeningPendingScreen';
export { SessionEntryScreen } from './SessionEntryScreen';
export { SessionLockedScreen } from './SessionLockedScreen';
export { SessionTransitionScreen } from './SessionTransitionScreen';

export { LikertScale, SelectionList } from './AnswerControls';
export type { AnswerOption } from './AnswerControls';
export { ResearchButton } from './ResearchButton';
export type { ResearchButtonVariant } from './ResearchButton';
export { ProgressIndicator } from './ProgressIndicator';
export { ScreenHeader } from './ScreenHeader';
export { SectionContainer } from './SectionContainer';
export {
  EmptyState,
  ErrorState,
  LoadingState,
} from './ScreenState';
export { researchCopy } from './researchContent';
export {
  displayFont,
  researchLayout,
  researchPalette,
  type ResearchPalette,
} from './researchTheme';