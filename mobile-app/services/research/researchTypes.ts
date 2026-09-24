import type { ResearchWorkflowPhase, BaselineAssessmentRecord } from '../companion/researchWorkflow';
import type { SessionPhase, InterventionSessionNumber } from '../companion/sessionOrchestrator';
import type { SessionSummary } from '../companion/sessionSummary';

export type AssessmentRole = 'pre' | 'post';

export type ConsentStatus = 'none' | 'pending' | 'consented' | 'declined';

// Columns in ananta_enrollments visible to the anon/authenticated role.
// research_code is intentionally excluded (column-level grants).
export interface EnrollmentRow {
  id: string;
  user_id: string;
  consent_status: ConsentStatus;
  consent_signed_at: string | null;
  workflow_phase: ResearchWorkflowPhase;
  confirmed_domain: string | null;
  created_at: string;
  updated_at: string;
}

export type ScreeningStatus = 'pending' | 'eligible' | 'not_eligible';

// Participant-visible screening columns. raw_responses and score are written
// only through the controlled RPC / staff paths and are never selected by the
// participant client.
export interface ScreeningRow {
  id: string;
  participant_id: string;
  instrument_id: string;
  instrument_version: string;
  status: ScreeningStatus;
  completed_at: string;
  created_at: string;
}

export interface ScreeningSubmission {
  instrument_id: string;
  instrument_version: string;
  raw_responses: unknown;
  completed_at: string;
  metadata: Record<string, unknown> | null;
}

export interface AssessmentRow {
  id: string;
  participant_id: string;
  domain: string;
  instrument_id: string;
  instrument_version: string;
  role: AssessmentRole;
  raw_responses: unknown;
  score: unknown;
  completed_at: string;
  metadata: Record<string, unknown> | null;
}

// Participant-visible assessment columns. raw_responses, score and metadata
// are excluded from direct reads by column-level SELECT grants; the read model
// and the mapping layer must never rely on them.
export interface ParticipantAssessmentRow {
  id: string;
  participant_id: string;
  domain: string;
  instrument_id: string;
  instrument_version: string;
  role: AssessmentRole;
  completed_at: string;
}

// A client-submitted assessment record. The domain must match the frozen
// confirmation domain, the role must match the workflow phase, and the score
// is NEVER supplied by the client (the DB always records score as null in the
// participant-controlled path).
export interface AssessmentSubmission {
  role: AssessmentRole;
  domain: string;
  instrument_id: string;
  instrument_version: string;
  raw_responses: unknown;
  completed_at: string;
  metadata: Record<string, unknown> | null;
}

export interface SessionRow {
  id: string;
  participant_id: string;
  session_number: number;
  status: SessionPhase;
  domain_snapshot: string | null;
  started_at: string | null;
  completed_at: string | null;
  summary: SessionSummary | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptRow {
  id: string;
  session_id: string;
  sequence_number: number;
  role: string;
  content: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface FeedbackInsert {
  participant_id: string;
  session_id: string | null;
  category: string;
  rating: number | null;
  comment: string | null;
}

export interface FeedbackRow extends FeedbackInsert {
  id: string;
  created_at: string;
}

export interface RecordAssessmentOutput {
  assessment: AssessmentRow;
  enrollment: EnrollmentRow;
}

export interface StartSessionOutput {
  session: SessionRow;
  enrollment: EnrollmentRow;
}

export interface ResearchStateReadModel {
  enrollment: EnrollmentRow;
  baseline: ParticipantAssessmentRow | null;
  screening: ScreeningRow | null;
  sessions: SessionRow[];
}

export type { ResearchWorkflowPhase, BaselineAssessmentRecord, SessionPhase, InterventionSessionNumber, SessionSummary };