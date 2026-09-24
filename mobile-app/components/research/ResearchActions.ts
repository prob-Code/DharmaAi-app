import type { ParticipantResearchController } from '../../services/research/researchController';
import type { QuestionnaireAnswers } from './QuestionnaireScreen';
import type { FeedbackInput } from './FeedbackScreen';

// Action contract between the ResearchExperience gate and the parent wiring.
//
// Simple actions (consent, entry, baseline start, session start) are backed
// directly by the controller via createDefaultResearchActions. The protocol
// builders below (screening / baseline / post-test submissions, domain
// confirmation, feedback, finish) cannot be defaulted: they construct
// instrument submissions and are owned by the primary integration layer.

export interface ResearchActions {
  onConsent?: () => void | Promise<unknown>;
  onBegin?: () => void | Promise<unknown>;
  onContinueDiscovery?: () => void | Promise<unknown>;
  onConfirmDomain?: () => void | Promise<unknown>;
  onReconsiderDomain?: () => void | Promise<unknown>;
  onBeginBaseline?: () => void | Promise<unknown>;
  onCompleteScreening?: (answers: QuestionnaireAnswers) => void | Promise<unknown>;
  onCompleteBaseline?: (answers: QuestionnaireAnswers) => void | Promise<unknown>;
  onCompletePostTest?: (answers: QuestionnaireAnswers) => void | Promise<unknown>;
  onStartSession?: (sessionNumber: 1 | 2 | 3) => void | Promise<unknown>;
  onPersistFeedback?: (input: FeedbackInput) => void | Promise<unknown>;
  onFinish?: () => void | Promise<unknown>;
}

export function createDefaultResearchActions(
  controller: ParticipantResearchController | null,
): ResearchActions {
  if (controller === null) {
    return {};
  }

  return {
    onConsent: () => controller.recordConsent(),
    onBegin: () => controller.beginResearch(),
    onBeginBaseline: () => controller.beginBaseline(),
    onStartSession: (sessionNumber) =>
      sessionNumber === 1
        ? controller.startSessionOne('standard')
        : controller.startNextSession('standard'),
  };
}