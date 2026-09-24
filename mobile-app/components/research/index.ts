// Participant research UI. Presentational surfaces only — the primary
// research controller / App wiring owns all state, callbacks, and protocol
// transitions.
export { AdssScreen } from './AdssScreen';
export { CompletionScreen } from './CompletionScreen';
export { ConsentScreen } from './ConsentScreen';
export { DomainConfirmationScreen } from './DomainConfirmationScreen';
export { FeedbackScreen, type FeedbackInput } from './FeedbackScreen';
export {
  QuestionnaireScreen,
  type QuestionnaireAnswers,
} from './QuestionnaireScreen';
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