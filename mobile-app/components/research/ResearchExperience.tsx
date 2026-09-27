import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { ResearchSnapshot, ParticipantResearchController } from '../../services/research/researchController';
import type { AnswerOption } from './AnswerControls';
import { AdssScreen } from './AdssScreen';
import { BaselineIntroScreen } from './BaselineIntroScreen';
import { CompletionScreen } from './CompletionScreen';
import { ConsentScreen } from './ConsentScreen';
import { DomainConfirmationScreen } from './DomainConfirmationScreen';
import { DomainDiscoveryScreen } from './DomainDiscoveryScreen';
import { FeedbackScreen, type FeedbackInput } from './FeedbackScreen';
import { NotEligibleScreen } from './NotEligibleScreen';
import {
  resolveParticipantStage,
  type ResearchHydrationStatus,
} from './participantFlow';
import { PostTestIntroScreen } from './PostTestIntroScreen';
import { QuestionnaireScreen, type QuestionnaireAnswers } from './QuestionnaireScreen';
import {
  createDefaultResearchActions,
  type ResearchActions,
} from './ResearchActions';
import { ResearchIntroScreen } from './ResearchIntroScreen';
import { researchCopy } from './researchContent';
import { ScreenHeader } from './ScreenHeader';
import { ScreeningPendingScreen } from './ScreeningPendingScreen';
import { SectionContainer } from './SectionContainer';
import { ErrorState, LoadingState } from './ScreenState';
import { SessionEntryScreen } from './SessionEntryScreen';
import { SessionLockedScreen } from './SessionLockedScreen';
import { SessionTransitionScreen } from './SessionTransitionScreen';
import { researchPalette } from './researchTheme';

interface QuestionnaireConfig {
  items?: ReadonlyArray<string>;
  scale?: ReadonlyArray<AnswerOption>;
}

export interface ResearchExperienceProps {
  status: ResearchHydrationStatus;
  snapshot: ResearchSnapshot | null;
  controller: ParticipantResearchController | null;
  error: string | null;
  onRetry: () => void;
  /** Protocol builders the primary integration layer supplies. The gate
   *  merges these over the controller-backed defaults. */
  actions?: ResearchActions;
  /** Content rendered while a session is active (the Companion surface). */
  children: React.ReactNode;
  screening?: QuestionnaireConfig;
  baseline?: QuestionnaireConfig;
  postTest?: QuestionnaireConfig;
  testID?: string;
}

// Orchestrates the participant research experience presentationally.
// It never owns protocol state: every stage is derived from the controller
// ResearchSnapshot, and every mutation is delegated to the actions the
// parent wires. Questionnaire submission builders (screening / baseline /
// post-test / feedback) construct the instrument submissions at the
// integration seam; until wired they render with a quiet preparation note.
export const ResearchExperience: React.FC<ResearchExperienceProps> = ({
  status,
  snapshot,
  controller,
  error: hydrationError,
  onRetry,
  actions: suppliedActions,
  children,
  screening,
  baseline,
  postTest,
  testID,
}) => {
  const copy = researchCopy;
  // Protocol builders supplied by the primary integration layer win; the
  // controller-backed defaults only fill the gaps they leave empty.
  const actions = { ...createDefaultResearchActions(controller), ...suppliedActions };

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [screeningAnswers, setScreeningAnswers] = useState<QuestionnaireAnswers>({});
  const [baselineAnswers, setBaselineAnswers] = useState<QuestionnaireAnswers>({});
  const [postAnswers, setPostAnswers] = useState<QuestionnaireAnswers>({});
  const [discoveryEntered, setDiscoveryEntered] = useState(false);
  const [journeyComplete, setJourneyComplete] = useState(false);
  const [researchCode, setResearchCode] = useState<string | null>(null);
  const researchCodeRequestedRef = useRef(false);
  const openingAdvanceStartedRef = useRef(false);
  const closingCompleteStartedRef = useRef(false);

  const stage = resolveParticipantStage(status, snapshot);

  // Post-test tail: intro → questions → feedback → completion. These are
  // presentation-only progressions shown after the final session; the
  // controller remains the source of truth. A hydrated (or in-session)
  // post-assessment record re-opens the tail at completion so a reload never
  // re-enters the questionnaire.
  const inTail = stage.stage === 'post_test_intro';
  const [postStage, setPostStage] = useState<'intro' | 'questions' | 'feedback' | 'done'>('intro');
  useEffect(() => {
    if (!inTail) {
      setPostStage('intro');
      setJourneyComplete(false);
      setResearchCode(null);
      researchCodeRequestedRef.current = false;
      return;
    }
    if (snapshot?.postAssessmentCompleted === true) {
      setPostStage(current => (current === 'intro' ? 'done' : current));
    }
  }, [inTail, snapshot?.postAssessmentCompleted]);

  // Discovery entry: the intro screen hands over to the Companion chat once;
  // leaving the discovery stage re-arms the intro.
  useEffect(() => {
    if (stage.stage !== 'domain_discovery') {
      setDiscoveryEntered(false);
    }
  }, [stage.stage]);

  // OPENING sessions move into the conversation without another tap; a failed
  // advance is retried quietly so the participant is never stranded.
  useEffect(() => {
    if (
      stage.stage !== 'session_active' ||
      snapshot?.session.sessionPhase !== 'OPENING' ||
      controller === null
    ) {
      openingAdvanceStartedRef.current = false;
      return;
    }
    if (openingAdvanceStartedRef.current) {
      return;
    }
    openingAdvanceStartedRef.current = true;
    let cancelled = false;
    const attempt = async (): Promise<void> => {
      if (cancelled) return;
      try {
        await controller.advanceActiveSession();
      } catch {
        if (cancelled) return;
        await new Promise<void>(resolve => setTimeout(resolve, 2500));
        await attempt();
      }
    };
    void attempt();
    return () => {
      cancelled = true;
      openingAdvanceStartedRef.current = false;
    };
  }, [stage.stage, snapshot?.session.sessionPhase, controller]);

  // CLOSING sessions (including a reload that lands mid-close) finish
  // quietly so the flow always reaches the next session or the post-test.
  useEffect(() => {
    if (stage.stage !== 'session_locked' || controller === null) {
      closingCompleteStartedRef.current = false;
      return;
    }
    if (closingCompleteStartedRef.current) {
      return;
    }
    closingCompleteStartedRef.current = true;
    let cancelled = false;
    const attempt = async (): Promise<void> => {
      if (cancelled) return;
      try {
        await controller.completeActiveSession();
      } catch {
        if (cancelled) return;
        await new Promise<void>(resolve => setTimeout(resolve, 2500));
        await attempt();
      }
    };
    void attempt();
    return () => {
      cancelled = true;
      closingCompleteStartedRef.current = false;
    };
  }, [stage.stage, controller]);

  // The research code is read once, the first time completion is shown.
  useEffect(() => {
    if (
      stage.stage !== 'post_test_intro' ||
      postStage !== 'done' ||
      controller === null ||
      researchCodeRequestedRef.current
    ) {
      return;
    }
    researchCodeRequestedRef.current = true;
    void controller
      .getMyResearchCode()
      .then(code => setResearchCode(code))
      .catch(() => setResearchCode(null));
  }, [stage.stage, postStage, controller]);

  const run = async (
    name: string,
    fn: (() => void | Promise<unknown>) | undefined,
  ): Promise<boolean> => {
    if (!fn || busyAction !== null) {
      return false;
    }
    setBusyAction(name);
    setActionError(null);
    try {
      await fn();
      return true;
    } catch {
      setActionError('Something interrupted. Your place here is kept — please try again.');
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const loading = (name: string): boolean => busyAction === name;
  const error = actionError ?? null;

  const renderMissing = () => {
    return (
      <SectionContainer testID={testID} scroll centered>
        <ScreenHeader eyebrow="A quiet moment" title="Almost ready" />
        <Text style={styles.missingNote} maxFontSizeMultiplier={1.2}>
          {copy.pendingWiring.note}
        </Text>
      </SectionContainer>
    );
  };

  switch (stage.stage) {
    case 'hydrating':
      return <LoadingState title="Preparing your space" body="One quiet moment…" />;

    case 'unavailable':
      return (
        <ErrorState
          title="A small pause"
          body="We could not reach your personal space right now."
          onRetry={onRetry}
          retryLabel="Try again"
          loading={loading('retry')}
        />
      );

    case 'consent':
      return actions.onConsent ? (
        <ConsentScreen
          testID={testID}
          accepted={consentAccepted}
          onAcceptChange={setConsentAccepted}
          onContinue={() => run('consent', actions.onConsent)}
          loading={loading('consent')}
          error={error}
        />
      ) : (
        renderMissing()
      );

    case 'introduction':
      return actions.onBegin ? (
        <ResearchIntroScreen
          testID={testID}
          onContinue={() => run('begin', actions.onBegin)}
          loading={loading('begin')}
          error={error}
        />
      ) : (
        renderMissing()
      );

    case 'screening':
      return (
        <AdssScreen
          testID={testID}
          items={screening?.items}
          scale={screening?.scale}
          answers={screeningAnswers}
          onAnswer={(index, value) =>
            setScreeningAnswers((prev) => ({ ...prev, [index]: value }))
          }
          onSubmit={(answers) => run('screening', () => actions.onCompleteScreening?.(answers))}
          actionNote={
            actions.onCompleteScreening ? undefined : copy.pendingWiring.note
          }
          loading={loading('screening')}
          error={error}
        />
      );

    case 'screening_pending':
      return <ScreeningPendingScreen testID={testID} />;

    case 'not_eligible':
      return <NotEligibleScreen testID={testID} />;

    case 'domain_discovery':
      if (!actions.onContinueDiscovery) {
        return renderMissing();
      }
      if (discoveryEntered) {
        return <>{children}</>;
      }
      return (
        <DomainDiscoveryScreen
          testID={testID}
          onContinue={() =>
            run('discovery', actions.onContinueDiscovery).then(entered => {
              if (entered) {
                setDiscoveryEntered(true);
              }
            })
          }
          loading={loading('discovery')}
          error={error}
        />
      );

    case 'domain_confirmation':
      return actions.onConfirmDomain && actions.onReconsiderDomain ? (
        <DomainConfirmationScreen
          testID={testID}
          scenario={stage.scenario}
          onConfirm={() => run('confirmDomain', actions.onConfirmDomain)}
          onReconsider={() => run('reconsiderDomain', actions.onReconsiderDomain)}
          loading={loading('confirmDomain') || loading('reconsiderDomain')}
          error={error}
        />
      ) : (
        renderMissing()
      );

    case 'baseline_intro':
      return actions.onBeginBaseline ? (
        <BaselineIntroScreen
          testID={testID}
          onContinue={() => run('beginBaseline', actions.onBeginBaseline)}
          loading={loading('beginBaseline')}
          error={error}
        />
      ) : (
        renderMissing()
      );

    case 'baseline': {
      const copyAssessment = copy.assessment;
      return (
        <QuestionnaireScreen
          testID={testID}
          eyebrow={copyAssessment.eyebrow}
          title={copyAssessment.title}
          subtitle={copyAssessment.subtitle}
          items={baseline?.items ?? copyAssessment.items}
          scale={baseline?.scale ?? copyAssessment.scale}
          answers={baselineAnswers}
          onAnswer={(index, value) =>
            setBaselineAnswers((prev) => ({ ...prev, [index]: value }))
          }
          onSubmit={(answers) => run('baseline', () => actions.onCompleteBaseline?.(answers))}
          submitLabel={copyAssessment.submitLabel}
          progressLabel={copyAssessment.progressLabel}
          actionNote={
            actions.onCompleteBaseline ? undefined : copy.pendingWiring.note
          }
          loading={loading('baseline')}
          error={error}
        />
      );
    }

    case 'session_entry':
      return actions.onStartSession ? (
        <SessionEntryScreen
          testID={testID}
          onBegin={() => run('session', () => actions.onStartSession?.(1))}
          loading={loading('session')}
          error={error}
        />
      ) : (
        renderMissing()
      );

    case 'session_transition':
      return actions.onStartSession ? (
        <SessionTransitionScreen
          testID={testID}
          sessionNumber={stage.sessionNumber}
          onBegin={() =>
            run('session', () => actions.onStartSession?.(stage.sessionNumber))
          }
          loading={loading('session')}
          error={error}
        />
      ) : (
        renderMissing()
      );

    case 'session_locked':
      return <SessionLockedScreen testID={testID} />;

    case 'session_active':
      return <>{children}</>;

    case 'post_test_intro': {
      if (journeyComplete) {
        return <>{children}</>;
      }
      if (postStage === 'done') {
        return (
          <CompletionScreen
            testID={testID}
            researchCode={researchCode}
            onFinish={
              actions.onFinish
                ? () =>
                    run('finish', actions.onFinish).then(completed => {
                      if (completed) {
                        setJourneyComplete(true);
                      }
                    })
                : undefined
            }
            loading={loading('finish')}
          />
        );
      }
      if (postStage === 'feedback') {
        return actions.onPersistFeedback ? (
          <FeedbackScreen
            testID={testID}
            onSubmit={(input: FeedbackInput) =>
              run('feedback', () => actions.onPersistFeedback?.(input)).then(submitted => {
                if (submitted) {
                  setPostStage('done');
                }
              })
            }
            loading={loading('feedback')}
            error={error}
          />
        ) : (
          renderMissing()
        );
      }
      if (postStage === 'questions') {
        const copyPost = copy.postTest;
        const copyAssessment = copy.assessment;
        return (
          <QuestionnaireScreen
            testID={testID}
            eyebrow={copyPost.eyebrow}
            title={copyPost.title}
            subtitle={copyPost.body}
            items={postTest?.items ?? copyAssessment.items}
            scale={postTest?.scale ?? copyAssessment.scale}
            answers={postAnswers}
            onAnswer={(index, value) =>
              setPostAnswers((prev) => ({ ...prev, [index]: value }))
            }
            onSubmit={(answers) => {
              run('postTest', () => actions.onCompletePostTest?.(answers)).then(submitted => {
                if (submitted) {
                  setPostStage('feedback');
                }
              });
            }}
            submitLabel={copyPost.continueLabel}
            progressLabel={copyAssessment.progressLabel}
            actionNote={actions.onCompletePostTest ? undefined : copy.pendingWiring.note}
            loading={loading('postTest')}
            error={error}
          />
        );
      }
      return (
        <PostTestIntroScreen
          testID={testID}
          onBegin={() => setPostStage('questions')}
          loading={false}
          error={null}
        />
      );
    }

    default:
      return renderMissing();
  }
};

const styles = StyleSheet.create({
  missingNote: {
    fontSize: 16,
    lineHeight: 26,
    color: researchPalette.muted,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
});