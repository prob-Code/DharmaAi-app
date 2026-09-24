import React, { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AdssScreen } from './AdssScreen';
import { CompletionScreen } from './CompletionScreen';
import { ConsentScreen } from './ConsentScreen';
import { DomainConfirmationScreen } from './DomainConfirmationScreen';
import { FeedbackScreen, type FeedbackInput } from './FeedbackScreen';
import { QuestionnaireScreen, type QuestionnaireAnswers } from './QuestionnaireScreen';
import { SessionTransitionScreen } from './SessionTransitionScreen';
import { EmptyState, ErrorState, LoadingState } from './ScreenState';
import { researchCopy } from './researchContent';
import type {
  ParticipantResearchController,
  FeedbackRequest,
  ResearchSnapshot,
} from '../../services/research/researchController';
import type { ResearchHydrationStatus } from '../../services/research/useParticipantResearch';
import { resolveResearchGateStep } from '../../services/research/researchGate';
import type {
  AssessmentSubmission,
  ScreeningSubmission,
} from '../../services/research/researchTypes';

interface ResearchGateProps {
  status: ResearchHydrationStatus;
  snapshot: ResearchSnapshot | null;
  controller: ParticipantResearchController | null;
  error: unknown;
  onRetry: () => void;
  children: ReactNode;
}

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

type PostStage = 'assessment' | 'feedback' | 'completion';

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function nowIso(): string {
  return new Date().toISOString();
}

export const ResearchGate: React.FC<ResearchGateProps> = ({
  status,
  snapshot,
  controller,
  error,
  onRetry,
  children,
}) => {
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswers>({});
  const [dismissCandidate, setDismissCandidate] = useState(false);
  const [postStage, setPostStage] = useState<PostStage>('assessment');
  const [postJourneyComplete, setPostJourneyComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const step = resolveResearchGateStep(status, snapshot);

  useEffect(() => {
    setActionError(null);
    setBusy(false);
    setConsentAccepted(false);
    setQuestionnaireAnswers({});
    setDismissCandidate(false);
    if (step.step !== 'post_test') {
      setPostStage('assessment');
      setPostJourneyComplete(false);
    }
  }, [step.step]);

  const runAction = async (action: () => Promise<unknown> | undefined) => {
    if (controller === null || busy) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (step.step === 'session_active') {
    return <View style={styles.container}>{children}</View>;
  }

  if (step.step === 'post_test' && postJourneyComplete) {
    return <View style={styles.container}>{children}</View>;
  }

  if (snapshot === null) {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  const handleAnswer = (itemIndex: number, value: string) => {
    setQuestionnaireAnswers((prev) => ({ ...prev, [itemIndex]: value }));
  };

  const handleBaselineSubmit = (answers: QuestionnaireAnswers) => {
    void runAction(async () => {
      const domain = snapshot.workflow.confirmedResearchDomain;
      if (domain === null) {
        throw new Error('The confirmed research domain is missing');
      }
      if (step.step === 'baseline_intro') {
        await controller?.beginBaseline();
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
      await controller?.completeBaseline(submission);
    });
  };

  const renderStep = () => {
    switch (step.step) {
      case 'hydrating':
        return <LoadingState />;

      case 'unavailable':
        return (
          <ErrorState
            title="Research is unavailable"
            body="The research experience could not be loaded. Nothing is lost — take a breath, and we can try again."
            onRetry={onRetry}
          />
        );

      case 'consent':
        return (
          <ConsentScreen
            accepted={consentAccepted}
            onAcceptChange={setConsentAccepted}
            onContinue={() =>
              void runAction(async () => {
                await controller?.recordConsent();
                await controller?.beginResearch();
              })
            }
            loading={busy}
            error={actionError}
          />
        );

      case 'entry':
        return (
          <EmptyState
            title="Your journey begins"
            body="A short check-in comes first, so we can be sure this is the right fit for you."
            actionLabel="Begin gently"
            onAction={() =>
              void runAction(async () => {
                await controller?.beginResearch();
              })
            }
          />
        );

      case 'screening':
        return (
          <AdssScreen
            answers={questionnaireAnswers}
            onAnswer={handleAnswer}
            onSubmit={(answers) =>
              void runAction(async () => {
                const submission: ScreeningSubmission = {
                  instrument_id: SCREENING_INSTRUMENT_ID,
                  instrument_version: SCREENING_INSTRUMENT_VERSION,
                  raw_responses: answers,
                  completed_at: nowIso(),
                  metadata: null,
                };
                await controller?.completeScreening(submission);
              })
            }
            loading={busy}
            error={actionError}
          />
        );

      case 'not_eligible':
        return (
          <EmptyState
            title="A gentle pause"
            body="Based on what you shared, this particular programme is not the right fit for you right now. That is a useful thing to know — and this space is still here, whenever you need it."
          />
        );

      case 'domain_discovery': {
        const candidate = snapshot.domainDiscovery.currentCandidateDomain;
        const scenario = snapshot.domainDiscovery.participantFacingScenario;
        if (candidate !== null && scenario.trim() !== '' && !dismissCandidate) {
          return (
            <DomainConfirmationScreen
              scenario={scenario}
              onConfirm={() =>
                void runAction(async () => {
                  await controller?.confirmDomainCandidate(candidate, scenario);
                })
              }
              onReconsider={() => setDismissCandidate(true)}
              loading={busy}
              error={actionError}
            />
          );
        }
        return (
          <EmptyState
            title="Choosing your focus"
            body="Your focus is chosen together, in the next part of this journey. Nothing is lost — you can return to this point anytime."
          />
        );
      }

      case 'baseline_intro':
      case 'baseline_pending':
        return (
          <QuestionnaireScreen
            title={researchCopy.assessment.title}
            subtitle={researchCopy.assessment.subtitle}
            eyebrow={researchCopy.assessment.eyebrow}
            items={researchCopy.assessment.items}
            scale={researchCopy.assessment.scale}
            answers={questionnaireAnswers}
            onAnswer={handleAnswer}
            onSubmit={handleBaselineSubmit}
            submitLabel={researchCopy.assessment.submitLabel}
            progressLabel={researchCopy.assessment.progressLabel}
            loading={busy}
            error={actionError}
          />
        );

      case 'sessions_entry':
      case 'session_next':
        return (
          <SessionTransitionScreen
            sessionNumber={
              step.step === 'sessions_entry' ? 1 : snapshot.session.currentSessionNumber
            }
            onBegin={() =>
              void runAction(async () => {
                if (step.step === 'sessions_entry') {
                  await controller?.startSessionOne('standard');
                } else {
                  await controller?.startNextSession('standard');
                }
              })
            }
            loading={busy}
            error={actionError}
          />
        );

      case 'post_test': {
        if (postStage === 'assessment') {
          return (
            <QuestionnaireScreen
              title={researchCopy.assessment.title}
              subtitle={researchCopy.assessment.subtitle}
              eyebrow={researchCopy.assessment.eyebrow}
              items={researchCopy.assessment.items}
              scale={researchCopy.assessment.scale}
              answers={questionnaireAnswers}
              onAnswer={handleAnswer}
              onSubmit={(answers) =>
                void runAction(async () => {
                  const domain = snapshot.workflow.confirmedResearchDomain;
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
                  await controller?.completePostAssessment(submission);
                  setQuestionnaireAnswers({});
                  setPostStage('feedback');
                })
              }
              submitLabel={researchCopy.assessment.submitLabel}
              progressLabel={researchCopy.assessment.progressLabel}
              loading={busy}
              error={actionError}
            />
          );
        }

        if (postStage === 'feedback') {
          return (
            <FeedbackScreen
              onSubmit={(input) =>
                void runAction(async () => {
                  await submitFeedback(controller, input);
                  setPostStage('completion');
                })
              }
              loading={busy}
              error={actionError}
            />
          );
        }

        return <CompletionScreen onFinish={() => setPostJourneyComplete(true)} />;
      }

      default:
        return null;
    }
  };

  const submitFeedback = async (
    target: ParticipantResearchController | null,
    input: FeedbackInput,
  ): Promise<void> => {
    if (target === null) {
      return;
    }
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
    await Promise.all(requests.map((request) => target.persistFeedback(request)));
  };

  return <View style={styles.container}>{renderStep()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});