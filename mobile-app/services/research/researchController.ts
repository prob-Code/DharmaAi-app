import type { DomainDiscoveryState } from '../companion/domainDiscovery';
import {
  beginDomainDiscovery,
  confirmCandidateDomain,
  createInitialDomainDiscoveryState,
  presentCandidateForConfirmation,
  setCandidateDomain,
} from '../companion/domainDiscovery';
import { DEFAULT_CONVERSATION_STATE, type UserTimeBudget } from '../companion/conversationState';
import {
  SESSION_NUMBERS,
  advanceSession,
  beginClosure,
  closeSession,
  createSessionOrchestratorState,
  startSession,
  type SessionOrchestratorState,
} from '../companion/sessionOrchestrator';
import type { SessionSummary } from '../companion/sessionSummary';
import {
  beginBaselineAssessment,
  beginResearchWorkflow,
  completeBaselineAssessment,
  confirmResearchDomain,
  createInitialResearchWorkflowState,
  startResearchSessionOne,
  type ResearchWorkflowState,
} from '../companion/researchWorkflow';
import {
  assessmentSubmissionToBaselineRecord,
  createDefaultSessionState,
  enrollmentRowToDomainDiscovery,
  enrollmentRowToWorkflow,
  serializeSessionSummary,
  sessionRowToOrchestratorState,
  assessmentRowToBaselineAssessment,
} from './researchMapping';
import {
  getResearchPersistence,
  isUniqueViolation,
  type ResearchPersistence,
} from './researchPersistence';
import type {
  AssessmentSubmission,
  EnrollmentRow,
  FeedbackRow,
  ResearchStateReadModel,
  ScreeningRow,
  ScreeningSubmission,
  SessionRow,
  TranscriptRow,
} from './researchTypes';

export interface ResearchSnapshot {
  enrollment: EnrollmentRow | null;
  workflow: ResearchWorkflowState;
  domainDiscovery: DomainDiscoveryState;
  screening: ScreeningRow | null;
  session: SessionOrchestratorState;
}

export type ResearchStateListener = (snapshot: ResearchSnapshot) => void;

export type FeedbackRequest = {
  category: string;
  rating?: number | null;
  comment?: string | null;
  sessionId?: string | null;
};

export class ParticipantResearchController {
  private readonly persistence: ResearchPersistence;
  private readonly userId: string;
  private readonly listener: ResearchStateListener | null;

  private enrollment: EnrollmentRow | null = null;
  private workflow: ResearchWorkflowState = createInitialResearchWorkflowState();
  private domainDiscovery: DomainDiscoveryState = createInitialDomainDiscoveryState();
  private screening: ScreeningRow | null = null;
  private session: SessionOrchestratorState = createDefaultSessionState();
  private currentSessionId: string | null = null;

  constructor(
    userId: string,
    persistence: ResearchPersistence,
    options: { onStateChange?: ResearchStateListener } = {},
  ) {
    this.userId = userId;
    this.persistence = persistence;
    this.listener = options.onStateChange ?? null;
  }

  static async create(
    userId: string,
    options: { onStateChange?: ResearchStateListener } = {},
  ): Promise<ParticipantResearchController> {
    const persistence = await getResearchPersistence();
    return new ParticipantResearchController(userId, persistence, options);
  }

  async hydrate(): Promise<ResearchSnapshot> {
    const state = await this.persistence.loadCurrentResearchState(this.userId);

    if (state === null) {
      this.enrollment = null;
      this.workflow = createInitialResearchWorkflowState();
      this.domainDiscovery = createInitialDomainDiscoveryState();
      this.screening = null;
      this.session = createDefaultSessionState();
      this.currentSessionId = null;
    } else {
      this.applyReadModel(state);
    }

    this.notify();
    return this.getSnapshot();
  }

  async recordConsent(): Promise<ResearchSnapshot> {
    const updated = await this.persistence.recordConsent();
    this.workflow = enrollmentRowToWorkflow(updated);
    this.domainDiscovery = enrollmentRowToDomainDiscovery(updated);
    this.enrollment = updated;

    this.notify();
    return this.getSnapshot();
  }

  async beginResearch(): Promise<ResearchSnapshot> {
    const updated = await this.persistence.beginResearch();
    this.applyEnrollmentRow(updated);
    this.domainDiscovery = beginDomainDiscovery(this.domainDiscovery);

    this.notify();
    return this.getSnapshot();
  }

  async completeScreening(input: ScreeningSubmission): Promise<ResearchSnapshot> {
    const row = await this.persistence.recordScreening(input);
    this.screening = row;

    this.notify();
    return this.getSnapshot();
  }

  async confirmDomainCandidate(
    candidateDomain: string,
    participantScenario: string,
  ): Promise<ResearchSnapshot> {
    if (this.workflow.phase === 'DOMAIN_CONFIRMED') {
      throw new Error('Research domain is already confirmed');
    }
    if (this.workflow.phase !== 'DOMAIN_DISCOVERY') {
      throw new Error('Domain confirmation is not available in the current workflow phase');
    }

    this.requireEligibleScreening();

    let discovery = this.domainDiscovery;
    discovery = setCandidateDomain(discovery, candidateDomain, participantScenario);
    discovery = presentCandidateForConfirmation(discovery);
    discovery = confirmCandidateDomain(discovery);

    const nextWorkflow = confirmResearchDomain(this.workflow, discovery);
    if (nextWorkflow === null) {
      throw new Error('Could not confirm the research domain');
    }

    const updated = await this.persistence.confirmDomain(candidateDomain);

    this.enrollment = updated;
    this.workflow = nextWorkflow;
    this.domainDiscovery = discovery;

    this.notify();
    return this.getSnapshot();
  }

  async beginBaseline(): Promise<ResearchSnapshot> {
    const next = beginBaselineAssessment(this.workflow);
    if (next === null) {
      throw new Error('Baseline assessment cannot begin in the current workflow phase');
    }

    const updated = await this.persistence.beginBaseline();

    this.enrollment = updated;
    this.workflow = next;

    this.notify();
    return this.getSnapshot();
  }

  async completeBaseline(input: AssessmentSubmission): Promise<ResearchSnapshot> {
    if (input.role !== 'pre') {
      throw new Error('The baseline assessment submission must carry the pre role');
    }

    const record = assessmentSubmissionToBaselineRecord(input);
    const next = completeBaselineAssessment(this.workflow, record);
    if (next === null) {
      throw new Error('Baseline assessment cannot be completed in the current state or with the given submission');
    }

    try {
      await this.persistence.recordAssessment(input);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // A duplicate pre-assessment means a previous attempt already recorded
      // the baseline and advanced the phase atomically in the DB; recover by
      // accepting the local transition.
    }

    this.workflow = next;

    this.notify();
    return this.getSnapshot();
  }

  async completePostAssessment(input: AssessmentSubmission): Promise<ResearchSnapshot> {
    if (input.role !== 'post') {
      throw new Error('The post assessment submission must carry the post role');
    }

    try {
      await this.persistence.recordAssessment(input);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    this.notify();
    return this.getSnapshot();
  }

  async startSessionOne(timeBudget: UserTimeBudget): Promise<ResearchSnapshot> {
    const confirmedDomain = this.workflow.confirmedResearchDomain;
    if (confirmedDomain === null) {
      throw new Error('Session 1 requires a confirmed research domain');
    }

    const conversationState = {
      ...DEFAULT_CONVERSATION_STATE,
      researchDomain: confirmedDomain,
    };
    const candidate = createSessionOrchestratorState(1, null, conversationState, {
      conversationState,
    });
    if (candidate === null) {
      throw new Error('Could not create a Session 1 orchestrator state');
    }

    const result = startResearchSessionOne(this.workflow, candidate, timeBudget);
    if (result === null) {
      throw new Error('Session 1 cannot start in the current state');
    }

    const persisted = await this.persistence.startSession(1);

    this.workflow = result.workflowState;
    this.session = result.sessionState;
    this.enrollment = persisted.enrollment;
    this.currentSessionId = persisted.session.id;

    this.notify();
    return this.getSnapshot();
  }

  async startNextSession(timeBudget: UserTimeBudget): Promise<ResearchSnapshot> {
    if (this.session.sessionPhase !== 'COMPLETED') {
      throw new Error('The current session must be finished before the next session can start');
    }
    if (this.session.currentSessionNumber >= SESSION_NUMBERS.length) {
      throw new Error('All intervention sessions are complete');
    }

    const nextNumber = this.session.currentSessionNumber + 1;
    const candidate = createSessionOrchestratorState(
      nextNumber,
      this.session.currentSessionNumber,
      this.session.conversationState,
    );
    if (candidate === null) {
      throw new Error(`Could not create a Session ${nextNumber} orchestrator state`);
    }

    const domainSnapshot = candidate.conversationState.researchDomain;
    if (domainSnapshot === null) {
      throw new Error('The confirmed research domain is missing');
    }

    const started = startSession(candidate, timeBudget);
    const persisted = await this.persistence.startSession(nextNumber);

    this.session = started;
    this.enrollment = persisted.enrollment;
    this.currentSessionId = persisted.session.id;

    this.notify();
    return this.getSnapshot();
  }

  async advanceActiveSession(): Promise<ResearchSnapshot> {
    const sessionId = this.currentSessionId;
    if (sessionId === null) {
      throw new Error('No active session to advance');
    }

    let next: SessionOrchestratorState;
    if (this.session.sessionPhase === 'OPENING') {
      next = advanceSession(this.session);
    } else if (this.session.sessionPhase === 'ACTIVE') {
      next = beginClosure(this.session);
    } else if (this.session.sessionPhase === 'CLOSING') {
      throw new Error('The active session is already closing; complete it to finish');
    } else {
      throw new Error('The active session cannot be advanced from its current phase');
    }

    const row = await this.persistence.advanceSession(sessionId);

    this.session = {
      ...next,
      sessionPhase: row.status,
      conversationState: {
        ...next.conversationState,
        researchDomain: row.domain_snapshot ?? next.conversationState.researchDomain,
      },
    };
    this.currentSessionId = row.id;

    this.notify();
    return this.getSnapshot();
  }

  async completeActiveSession(
    summaryOverrides: Partial<SessionSummary> = {},
  ): Promise<ResearchSnapshot> {
    const sessionId = this.currentSessionId;
    if (sessionId === null) {
      throw new Error('No active session to complete');
    }
    if (this.session.sessionPhase !== 'CLOSING') {
      throw new Error('The active session must be closing before it can be completed');
    }

    const completed = closeSession(this.session, summaryOverrides);
    if (completed.activeSummary === null) {
      throw new Error('Session completion produced no summary');
    }

    const summary = serializeSessionSummary(completed.activeSummary);
    const row = await this.persistence.completeSession(sessionId, summary);

    this.session = {
      ...completed,
      sessionPhase: row.status,
      activeSummary: row.summary === null ? completed.activeSummary : row.summary,
    };
    this.currentSessionId = row.id;

    this.notify();
    return this.getSnapshot();
  }

  async appendTranscript(
    role: string,
    content: string,
    metadata?: Record<string, unknown>,
    createdAt?: string,
  ): Promise<TranscriptRow> {
    const sessionId = this.getActiveSessionId();
    if (sessionId === null) {
      throw new Error('No in-progress session to append a transcript event to');
    }

    return this.persistence.appendTranscriptEvent(sessionId, role, content, createdAt, metadata);
  }

  async persistFeedback(input: FeedbackRequest): Promise<FeedbackRow> {
    const participantId = this.requireEnrollmentId();
    const sessionId = input.sessionId === undefined ? this.getActiveSessionId() : input.sessionId;

    return this.persistence.persistFeedback({
      participant_id: participantId,
      session_id: sessionId,
      category: input.category,
      rating: input.rating ?? null,
      comment: input.comment ?? null,
    });
  }

  getSnapshot(): ResearchSnapshot {
    return {
      enrollment: this.enrollment === null ? null : { ...this.enrollment },
      workflow: { ...this.workflow },
      domainDiscovery: { ...this.domainDiscovery },
      screening: this.screening === null ? null : { ...this.screening },
      session: { ...this.session },
    };
  }

  getEnrollmentId(): string | null {
    return this.enrollment === null ? null : this.enrollment.id;
  }

  getActiveSessionId(): string | null {
    if (
      this.session.sessionPhase === 'NOT_STARTED' ||
      this.session.sessionPhase === 'COMPLETED'
    ) {
      return null;
    }

    return this.currentSessionId;
  }

  private applyReadModel(state: ResearchStateReadModel): void {
    this.enrollment = state.enrollment;
    this.workflow = enrollmentRowToWorkflow(state.enrollment);

    const baseline =
      state.baseline === null ? null : assessmentRowToBaselineAssessment(state.baseline);
    if (baseline !== null) {
      this.workflow = { ...this.workflow, baselineAssessment: baseline };
    }

    this.domainDiscovery = enrollmentRowToDomainDiscovery(state.enrollment);
    this.screening = state.screening === null ? null : { ...state.screening };

    const latestSession = state.sessions[state.sessions.length - 1];
    this.session =
      latestSession === undefined
        ? createDefaultSessionState()
        : sessionRowToOrchestratorState(latestSession);
    this.currentSessionId = latestSession === undefined ? null : latestSession.id;
  }

  private applyEnrollmentRow(row: EnrollmentRow): void {
    const workflow = enrollmentRowToWorkflow(row);
    this.workflow = {
      ...workflow,
      baselineAssessment: this.workflow.baselineAssessment,
    };
    this.domainDiscovery = enrollmentRowToDomainDiscovery(row);
    this.enrollment = row;
  }

  private notify(): void {
    if (this.listener !== null) {
      this.listener(this.getSnapshot());
    }
  }

  private requireEnrollmentId(): string {
    if (this.enrollment === null) {
      throw new Error('Research enrollment does not exist for this participant');
    }

    return this.enrollment.id;
  }

  private requireEligibleScreening(): void {
    if (this.screening === null || this.screening.status !== 'eligible') {
      throw new Error('A valid screening result is required before the research domain can be confirmed');
    }
  }
}