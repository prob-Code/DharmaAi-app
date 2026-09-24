import type {
  FeedbackRequest,
  ParticipantResearchController,
  ResearchSnapshot,
} from '../../services/research/researchController';
import type {
  AssessmentSubmission,
  ScreeningSubmission,
} from '../../services/research/researchTypes';
import type { ResearchActions } from './ResearchActions';
import type { FeedbackInput } from './FeedbackScreen';
import type { QuestionnaireAnswers } from './QuestionnaireScreen';
import { researchCopy } from './researchContent';

// Protocol builders wired to the existing ParticipantResearchController API.
//
// These adapt the presentational research surfaces to the controller's
// instrument submissions. Every method below already exists on the
// controller; none of them writes to Supabase directly. Action keys without a
// controller-backed counterpart (discovery continuation, domain reconsider,
// post-journey finish) are intentionally left unwired so the experience
// boundary stays explicit and fails safely.

const SCREENING_INSTRUMENT_ID = 'adss-v1';
const SCREENING_INSTRUMENT_VERSION = '1.0.0';
const BASELINE_INSTRUMENT_ID = 'baseline-pre';
const POST_INSTRUMENT_ID = 'baseline-post';
const INSTRUMENT_VERSION = 'v1';

const FEEDBACK_RATING_VALUES: Record<string, number> = {
  not_at_all: 1,
  a_little: 2,
  somewhat: 3,
  mostly: 4,
  very: 5,
};

function nowIso(): string {
  return new Date().toISOString();
}

export function createResearchProtocolActions(
  controller: ParticipantResearchController | null,
  snapshot: ResearchSnapshot | null,
): ResearchActions {
  if (controller === null || snapshot === null) {
    return {};
  }

  const domain = snapshot.workflow.confirmedResearchDomain;

  return {
    onCompleteScreening: (answers: QuestionnaireAnswers) => {
      const submission: ScreeningSubmission = {
        instrument_id: SCREENING_INSTRUMENT_ID,
        instrument_version: SCREENING_INSTRUMENT_VERSION,
        raw_responses: answers,
        completed_at: nowIso(),
        metadata: null,
      };
      return controller.completeScreening(submission);
    },

    onCompleteBaseline: (answers: QuestionnaireAnswers) => {
      if (domain === null) {
        throw new Error('The confirmed research domain is missing');
      }
      const submission: AssessmentSubmission = {
        role: 'pre',
        domain,
        instrument_id: BASELINE_INSTRUMENT_ID,
        instrument_version: INSTRUMENT_VERSION,
        raw_responses: answers,
        completed_at: nowIso(),
        metadata: null,
      };
      return controller.completeBaseline(submission);
    },

    onCompletePostTest: (answers: QuestionnaireAnswers) => {
      if (domain === null) {
        throw new Error('The confirmed research domain is missing');
      }
      const submission: AssessmentSubmission = {
        role: 'post',
        domain,
        instrument_id: POST_INSTRUMENT_ID,
        instrument_version: INSTRUMENT_VERSION,
        raw_responses: answers,
        completed_at: nowIso(),
        metadata: null,
      };
      return controller.completePostAssessment(submission);
    },

    onPersistFeedback: (input: FeedbackInput) => {
      const comment = input.comment?.trim() ?? '';
      const requests: FeedbackRequest[] = [];
      for (const category of researchCopy.feedback.categories) {
        const rating = input.ratings[category.id];
        if (rating === undefined) {
          continue;
        }
        requests.push({
          category: category.id,
          rating: FEEDBACK_RATING_VALUES[rating] ?? null,
          comment: comment.length > 0 ? comment : null,
        });
      }
      return Promise.all(requests.map((request) => controller.persistFeedback(request)));
    },
  };
}