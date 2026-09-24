import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionSummary } from '../companion/sessionSummary';
import { serializeSessionSummary } from './researchMapping';
import type {
  AssessmentSubmission,
  EnrollmentRow,
  FeedbackInsert,
  FeedbackRow,
  ParticipantAssessmentRow,
  RecordAssessmentOutput,
  ResearchStateReadModel,
  ScreeningRow,
  ScreeningSubmission,
  SessionRow,
  StartSessionOutput,
  TranscriptRow,
} from './researchTypes';

const ENROLLMENT_COLUMNS =
  'id, user_id, consent_status, consent_signed_at, workflow_phase, confirmed_domain, created_at, updated_at';

const SCREENING_COLUMNS =
  'id, participant_id, instrument_id, instrument_version, status, completed_at, created_at';

const ASSESSMENT_COLUMNS =
  'id, participant_id, domain, instrument_id, instrument_version, role, completed_at';

const SESSION_COLUMNS =
  'id, participant_id, session_number, status, domain_snapshot, started_at, completed_at, summary, created_at, updated_at';

export interface ResearchPersistence {
  loadResearchEnrollment(userId: string): Promise<EnrollmentRow | null>;
  loadCurrentResearchState(userId: string): Promise<ResearchStateReadModel | null>;
  recordConsent(): Promise<EnrollmentRow>;
  beginResearch(): Promise<EnrollmentRow>;
  recordScreening(input: ScreeningSubmission): Promise<ScreeningRow>;
  confirmDomain(candidateDomain: string): Promise<EnrollmentRow>;
  beginBaseline(): Promise<EnrollmentRow>;
  recordAssessment(input: AssessmentSubmission): Promise<RecordAssessmentOutput>;
  startSession(sessionNumber: number): Promise<StartSessionOutput>;
  advanceSession(sessionId: string): Promise<SessionRow>;
  completeSession(sessionId: string, summary: SessionSummary): Promise<SessionRow>;
  appendTranscriptEvent(
    sessionId: string,
    role: string,
    content: string,
    createdAt?: string,
    metadata?: Record<string, unknown>,
  ): Promise<TranscriptRow>;
  persistFeedback(input: FeedbackInsert): Promise<FeedbackRow>;
}

export function isUniqueViolation(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string; message?: string };
  if (candidate.code === '23505') {
    return true;
  }

  return (
    typeof candidate.message === 'string' &&
    candidate.message.toLowerCase().includes('duplicate key value violates unique constraint')
  );
}

function rpcEnvelope<T>(data: unknown, name: string): T {
  if (data === null || data === undefined) {
    throw new Error(`${name} returned no row`);
  }

  return data as T;
}

export function createResearchPersistence(client: SupabaseClient): ResearchPersistence {
  return {
    async loadResearchEnrollment(userId: string): Promise<EnrollmentRow | null> {
      const { data, error } = await client
        .from('ananta_enrollments')
        .select(ENROLLMENT_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data ?? null) as EnrollmentRow | null;
    },

    async recordConsent(): Promise<EnrollmentRow> {
      const { data, error } = await client.rpc('ananta_record_consent');

      if (error) {
        throw error;
      }

      return rpcEnvelope<EnrollmentRow>(data, 'ananta_record_consent');
    },

    async beginResearch(): Promise<EnrollmentRow> {
      const { data, error } = await client.rpc('ananta_begin_research');

      if (error) {
        throw error;
      }

      return rpcEnvelope<EnrollmentRow>(data, 'ananta_begin_research');
    },

    async recordScreening(input: ScreeningSubmission): Promise<ScreeningRow> {
      const { data, error } = await client.rpc('ananta_record_screening', {
        p_instrument_id: input.instrument_id,
        p_instrument_version: input.instrument_version,
        p_raw_responses: input.raw_responses,
        p_completed_at: input.completed_at,
        p_metadata: input.metadata ?? null,
      });

      if (error) {
        throw error;
      }

      return rpcEnvelope<ScreeningRow>(data, 'ananta_record_screening');
    },

    async confirmDomain(candidateDomain: string): Promise<EnrollmentRow> {
      const { data, error } = await client.rpc('ananta_confirm_domain', {
        p_domain: candidateDomain,
      });

      if (error) {
        throw error;
      }

      return rpcEnvelope<EnrollmentRow>(data, 'ananta_confirm_domain');
    },

    async beginBaseline(): Promise<EnrollmentRow> {
      const { data, error } = await client.rpc('ananta_begin_baseline');

      if (error) {
        throw error;
      }

      return rpcEnvelope<EnrollmentRow>(data, 'ananta_begin_baseline');
    },

    async recordAssessment(input: AssessmentSubmission): Promise<RecordAssessmentOutput> {
      const { data, error } = await client.rpc('ananta_record_assessment', {
        p_role: input.role,
        p_domain: input.domain,
        p_instrument_id: input.instrument_id,
        p_instrument_version: input.instrument_version,
        p_raw_responses: input.raw_responses ?? null,
        p_completed_at: input.completed_at,
        p_metadata: input.metadata ?? null,
      });

      if (error) {
        throw error;
      }

      return rpcEnvelope<RecordAssessmentOutput>(data, 'ananta_record_assessment');
    },

    async startSession(sessionNumber: number): Promise<StartSessionOutput> {
      const { data, error } = await client.rpc('ananta_start_session', {
        p_session_number: sessionNumber,
      });

      if (error) {
        throw error;
      }

      return rpcEnvelope<StartSessionOutput>(data, 'ananta_start_session');
    },

    async advanceSession(sessionId: string): Promise<SessionRow> {
      const { data, error } = await client.rpc('ananta_advance_session', {
        p_session_id: sessionId,
      });

      if (error) {
        throw error;
      }

      return rpcEnvelope<SessionRow>(data, 'ananta_advance_session');
    },

    async completeSession(sessionId: string, summary: SessionSummary): Promise<SessionRow> {
      const { data, error } = await client.rpc('ananta_complete_session', {
        p_session_id: sessionId,
        p_summary: serializeSessionSummary(summary),
      });

      if (error) {
        throw error;
      }

      return rpcEnvelope<SessionRow>(data, 'ananta_complete_session');
    },

    async appendTranscriptEvent(
      sessionId: string,
      role: string,
      content: string,
      createdAt?: string,
      metadata?: Record<string, unknown>,
    ): Promise<TranscriptRow> {
      const { data, error } = await client.rpc('ananta_append_transcript', {
        p_session_id: sessionId,
        p_role: role,
        p_content: content,
        p_created_at: createdAt ?? new Date().toISOString(),
        p_metadata: metadata ?? {},
      });

      if (error) {
        throw error;
      }

      return rpcEnvelope<TranscriptRow>(data, 'ananta_append_transcript');
    },

    async persistFeedback(input: FeedbackInsert): Promise<FeedbackRow> {
      const { data, error } = await client
        .from('ananta_feedback')
        .insert(input)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as FeedbackRow;
    },

    async loadCurrentResearchState(userId: string): Promise<ResearchStateReadModel | null> {
      const enrollment = await this.loadResearchEnrollment(userId);

      if (enrollment === null) {
        return null;
      }

      const [baselineRequest, screeningRequest, sessionsRequest] = await Promise.all([
        client
          .from('ananta_assessments')
          .select(ASSESSMENT_COLUMNS)
          .eq('participant_id', enrollment.id)
          .eq('role', 'pre')
          .maybeSingle(),
        client
          .from('ananta_screenings')
          .select(SCREENING_COLUMNS)
          .eq('participant_id', enrollment.id)
          .maybeSingle(),
        client
          .from('ananta_sessions')
          .select(SESSION_COLUMNS)
          .eq('participant_id', enrollment.id)
          .order('session_number', { ascending: true }),
      ]);

      if (baselineRequest.error) {
        throw baselineRequest.error;
      }

      if (screeningRequest.error) {
        throw screeningRequest.error;
      }

      if (sessionsRequest.error) {
        throw sessionsRequest.error;
      }

      return {
        enrollment,
        baseline: (baselineRequest.data ?? null) as ParticipantAssessmentRow | null,
        screening: (screeningRequest.data ?? null) as ScreeningRow | null,
        sessions: (sessionsRequest.data ?? []) as SessionRow[],
      };
    },
  };
}

let defaultPersistence: ResearchPersistence | null = null;

export async function getResearchPersistence(): Promise<ResearchPersistence> {
  if (defaultPersistence === null) {
    // Lazy dynamic import: keeps React Native dependencies out of the
    // pure-Node test path, where an injected client is always used instead.
    const { supabase } = await import('../supabase');
    defaultPersistence = createResearchPersistence(supabase as SupabaseClient);
  }

  return defaultPersistence;
}