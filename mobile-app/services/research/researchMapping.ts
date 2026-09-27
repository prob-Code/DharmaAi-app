import {
  createInitialDomainDiscoveryState,
  type DomainDiscoveryState,
} from '../companion/domainDiscovery';
import { DEFAULT_CONVERSATION_STATE } from '../companion/conversationState';
import {
  DEFAULT_SESSION_ORCHESTRATOR_STATE,
  getSessionObjective,
  type SessionOrchestratorState,
  type InterventionSessionNumber,
} from '../companion/sessionOrchestrator';
import type { SessionSummary } from '../companion/sessionSummary';
import type { ResearchWorkflowState, BaselineAssessmentRecord } from '../companion/researchWorkflow';
import type {
  AssessmentSubmission,
  EnrollmentRow,
  ParticipantAssessmentRow,
  SessionRow,
} from './researchTypes';

export function enrollmentRowToWorkflow(row: EnrollmentRow): ResearchWorkflowState {
  return {
    phase: row.workflow_phase,
    confirmedResearchDomain: row.confirmed_domain,
    baselineAssessment: null,
  };
}

export function enrollmentRowToDomainDiscovery(row: EnrollmentRow): DomainDiscoveryState {
  if (row.confirmed_domain !== null) {
    return createInitialDomainDiscoveryState({
      status: 'CONFIRMED',
      currentCandidateDomain: row.confirmed_domain,
      participantConfirmation: 'CONFIRMED',
      participantFacingScenario: '',
      isDiscoveryComplete: true,
      fixedResearchDomain: row.confirmed_domain,
    });
  }

  if (row.workflow_phase === 'NOT_STARTED') {
    return createInitialDomainDiscoveryState();
  }

  return createInitialDomainDiscoveryState({ status: 'EXPLORING' });
}

export function assessmentRowToBaselineAssessment(
  row: ParticipantAssessmentRow,
): BaselineAssessmentRecord | null {
  if (row.role !== 'pre') {
    return null;
  }

  return {
    instrumentId: row.instrument_id,
    instrumentVersion: row.instrument_version,
    researchDomain: row.domain,
    completedAt: row.completed_at,
    role: 'pre',
  };
}

export function assessmentSubmissionToBaselineRecord(
  submission: AssessmentSubmission,
): BaselineAssessmentRecord {
  return {
    instrumentId: submission.instrument_id,
    instrumentVersion: submission.instrument_version,
    researchDomain: submission.domain,
    completedAt: submission.completed_at,
    role: 'pre',
  };
}

export function sessionRowToOrchestratorState(
  row: SessionRow,
): SessionOrchestratorState {
  const sessionNumber = row.session_number as InterventionSessionNumber;

  return {
    currentSessionNumber: sessionNumber,
    sessionPhase: row.status,
    sessionObjective: getSessionObjective(sessionNumber),
    conversationState: {
      ...DEFAULT_CONVERSATION_STATE,
      sessionNumber,
      researchDomain: row.domain_snapshot,
    },
    activeSummary: row.summary === null ? null : serializeSessionSummary(row.summary),
  };
}

export function createDefaultSessionState(): SessionOrchestratorState {
  return {
    ...DEFAULT_SESSION_ORCHESTRATOR_STATE,
    conversationState: {
      ...DEFAULT_CONVERSATION_STATE,
    },
  };
}

export function serializeSessionSummary(summary: SessionSummary): SessionSummary {
  return {
    sessionNumber: summary.sessionNumber,
    researchDomain: summary.researchDomain,
    keyConcerns: [...summary.keyConcerns],
    importantThemes: [...summary.importantThemes],
    participantStatedGoals: [...summary.participantStatedGoals],
    usefulReflections: [...summary.usefulReflections],
    unresolvedTopics: [...summary.unresolvedTopics],
    interactionPreferences: [...summary.interactionPreferences],
    sensitiveContextPresent: summary.sensitiveContextPresent,
    closureNotes: [...summary.closureNotes],
  };
}