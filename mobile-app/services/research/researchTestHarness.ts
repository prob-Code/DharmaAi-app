import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResearchPersistence } from './researchPersistence';
import type {
  AssessmentRow,
  AssessmentSubmission,
  EnrollmentRow,
  FeedbackRow,
  ScreeningRow,
  ScreeningStatus,
  ScreeningSubmission,
  SessionRow,
  TranscriptRow,
} from './researchTypes';

type Row = Record<string, unknown>;

// Full store row for screenings: the participant-visible ScreeningRow omits
// raw_responses and score, but the store keeps them for the controlled path.
export interface ScreeningStoreRow extends ScreeningRow {
  raw_responses: unknown;
  score: unknown;
  metadata: Record<string, unknown> | null;
}

export interface ResearchTestDb {
  enrollments: EnrollmentRow[];
  assessments: AssessmentRow[];
  sessions: SessionRow[];
  screenings: ScreeningStoreRow[];
  transcripts: TranscriptRow[];
  feedback: FeedbackRow[];
  authUserId: string | null;
}

let idCounter = 0;
export function nextId(): string {
  idCounter += 1;
  return `fake-${idCounter}`;
}

const UNIQUE_KEYS: Record<string, Array<Array<keyof Row>>> = {
  ananta_enrollments: [['user_id'], ['research_code']],
  ananta_assessments: [['participant_id', 'role']],
  ananta_sessions: [['participant_id', 'session_number']],
  ananta_screenings: [['participant_id']],
  ananta_transcripts: [['session_id', 'sequence_number']],
};

export interface FakeError {
  code: string;
  message: string;
  details: string;
}

interface FakeResult {
  data: unknown;
  error: FakeError | null;
}

export function uniqueError(table: string, keys: Array<keyof Row>): FakeError {
  return {
    code: '23505',
    message: `duplicate key value violates unique constraint "${table}_${keys.join('_')}_key"`,
    details: `Key (${keys.join(', ')}) already exists.`,
  };
}

function authError(): FakeError {
  return {
    code: 'ananta-auth',
    message: 'auth.uid() resolved to null: request is not authenticated',
    details: '',
  };
}

function protocolError(operation: string, reason: string): FakeError {
  return {
    code: 'ananta-protocol',
    message: `${operation}: ${reason}`,
    details: '',
  };
}

function noRowError(): FakeError {
  return {
    code: 'PGRST116',
    message: 'JSON object requested, multiple (or no) rows returned',
    details: '',
  };
}

function tableStore(db: ResearchTestDb, table: string): Row[] {
  switch (table) {
    case 'ananta_enrollments':
      return db.enrollments as unknown as Row[];
    case 'ananta_assessments':
      return db.assessments as unknown as Row[];
    case 'ananta_sessions':
      return db.sessions as unknown as Row[];
    case 'ananta_screenings':
      return db.screenings as unknown as Row[];
    case 'ananta_transcripts':
      return db.transcripts as unknown as Row[];
    case 'ananta_feedback':
      return db.feedback as unknown as Row[];
    default:
      throw new Error(`fake supabase: unknown table ${table}`);
  }
}

function requireAuth(db: ResearchTestDb): Row {
  const userId = db.authUserId;
  if (userId === null || userId === undefined) {
    throw { data: null, error: authError() } as FakeResult;
  }

  const row = db.enrollments.find(enrollment => enrollment.user_id === userId);
  if (row === undefined) {
    throw { data: null, error: protocolError('ananta_rpc', 'enrollment required') } as FakeResult;
  }

  return row as unknown as Row;
}

function enrollmentView(raw: Row): Row {
  const out: Row = { ...raw };
  delete out.research_code;
  return out;
}

function enrollmentJson(enrollment: Row): Row {
  return {
    id: enrollment.id,
    user_id: enrollment.user_id,
    consent_status: enrollment.consent_status,
    consent_signed_at: enrollment.consent_signed_at,
    workflow_phase: enrollment.workflow_phase,
    confirmed_domain: enrollment.confirmed_domain,
    created_at: enrollment.created_at,
    updated_at: enrollment.updated_at,
  };
}

function requireConsent(db: ResearchTestDb, enrollment: Row): void {
  if (enrollment.consent_status !== 'consented') {
    throw {
      data: null,
      error: protocolError('ananta_begin_research', 'consent required'),
    } as FakeResult;
  }
}

function screeningView(raw: ScreeningStoreRow): ScreeningRow {
  return {
    id: raw.id,
    participant_id: raw.participant_id,
    instrument_id: raw.instrument_id,
    instrument_version: raw.instrument_version,
    status: raw.status,
    completed_at: raw.completed_at,
    created_at: raw.created_at,
  };
}

function project(row: Row, columns: string | null): Row {
  if (columns === null || columns === '' || columns === '*') {
    return { ...row };
  }

  const out: Row = {};
  for (const column of columns.split(',').map(column => column.trim())) {
    out[column] = row[column];
  }

  return out;
}

interface BuilderState {
  mode: 'select' | 'insert' | 'update';
  payload: Row | null;
  filters: Array<[string, unknown]>;
  orderColumn: string | null;
  orderAscending: boolean;
  single: boolean;
  maybeSingle: boolean;
  columns: string | null;
}

function newBuilderState(): BuilderState {
  return {
    mode: 'select',
    payload: null,
    filters: [],
    orderColumn: null,
    orderAscending: true,
    single: false,
    maybeSingle: false,
    columns: null,
  };
}

class FakePostgrestBuilder implements PromiseLike<FakeResult> {
  private readonly state: BuilderState = newBuilderState();

  constructor(
    private readonly db: ResearchTestDb,
    private readonly table: string,
  ) {}

  select(columns?: string): FakePostgrestBuilder {
    this.state.columns = columns ?? null;
    return this;
  }

  insert(payload: Row): FakePostgrestBuilder {
    this.state.mode = 'insert';
    this.state.payload = payload;
    return this;
  }

  update(payload: Row): FakePostgrestBuilder {
    this.state.mode = 'update';
    this.state.payload = payload;
    return this;
  }

  eq(column: string, value: unknown): FakePostgrestBuilder {
    this.state.filters.push([column, value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): FakePostgrestBuilder {
    this.state.orderColumn = column;
    this.state.orderAscending = options?.ascending ?? true;
    return this;
  }

  single(): FakePostgrestBuilder {
    this.state.single = true;
    return this;
  }

  maybeSingle(): FakePostgrestBuilder {
    this.state.maybeSingle = true;
    return this;
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): FakeResult {
    try {
      if (this.state.mode === 'insert') {
        return this.executeInsert();
      }
      if (this.state.mode === 'update') {
        return this.executeUpdate();
      }
      return this.executeSelect();
    } catch (result) {
      return result as FakeResult;
    }
  }

  private executeInsert(): FakeResult {
    const payload = this.state.payload ?? {};
    const result = insertRow(this.db, this.table, payload);
    if (result.error !== null) {
      return result;
    }

    const row = result.data as Row;
    const projection = project(row, this.state.columns);
    if (this.state.single || this.state.maybeSingle) {
      return { data: projection, error: null };
    }

    return { data: [projection], error: null };
  }

  private executeUpdate(): FakeResult {
    const store = tableStore(this.db, this.table);
    const matches = store.filter(row => this.matches(row));

    for (const row of matches) {
      Object.assign(row, this.state.payload ?? {});
      if (this.table === 'ananta_enrollments' || this.table === 'ananta_sessions') {
        row.updated_at = new Date().toISOString();
      }
    }

    const projection = matches.map(row => project(row, this.state.columns));

    if (this.state.single) {
      if (projection.length === 1) {
        return { data: projection[0], error: null };
      }
      return { data: null, error: noRowError() };
    }

    return { data: projection, error: null };
  }

  private executeSelect(): FakeResult {
    const store = tableStore(this.db, this.table);
    const rows = store
      .filter(row => this.matches(row))
      .map(row => project(row, this.state.columns));

    if (this.state.orderColumn !== null) {
      rows.sort((a, b) => {
        const left = a[this.state.orderColumn!] as number | string;
        const right = b[this.state.orderColumn!] as number | string;
        if (left === right) {
          return 0;
        }
        const comparison = left < right ? -1 : 1;
        return this.state.orderAscending ? comparison : -comparison;
      });
    }

    if (this.state.maybeSingle) {
      if (rows.length === 0) {
        return { data: null, error: null };
      }
      if (rows.length > 1) {
        return { data: null, error: noRowError() };
      }
      return { data: rows[0], error: null };
    }

    if (this.state.single) {
      if (rows.length === 1) {
        return { data: rows[0], error: null };
      }
      return { data: null, error: noRowError() };
    }

    return { data: rows, error: null };
  }

  private matches(row: Row): boolean {
    return this.state.filters.every(([column, value]) => row[column] === value);
  }
}

function insertRow(db: ResearchTestDb, table: string, payload: Row): FakeResult {
  const store = tableStore(db, table);
  const uniques = UNIQUE_KEYS[table] ?? [];

  for (const keys of uniques) {
    const existing = store.find(row => keys.every(key => row[key] === payload[key]));
    if (existing !== undefined) {
      return { data: null, error: uniqueError(table, keys) };
    }
  }

  const now = new Date().toISOString();
  const row: Row = {
    ...payload,
    id: nextId(),
    created_at: payload.created_at ?? now,
  };

  if (table === 'ananta_enrollments') {
    row.research_code = 'AN-FAKE' + nextId();
    row.consent_status = payload.consent_status ?? 'none';
    row.consent_signed_at = payload.consent_signed_at ?? null;
    row.workflow_phase = payload.workflow_phase ?? 'NOT_STARTED';
    row.confirmed_domain = payload.confirmed_domain ?? null;
    row.updated_at = now;
  }

  if (table === 'ananta_sessions') {
    row.domain_snapshot = payload.domain_snapshot ?? null;
    row.started_at = payload.started_at ?? null;
    row.completed_at = payload.completed_at ?? null;
    row.summary = payload.summary ?? null;
    row.updated_at = now;
  }

  if (table === 'ananta_screenings') {
    row.instrument_id = payload.instrument_id ?? null;
    row.instrument_version = payload.instrument_version ?? null;
    row.raw_responses = payload.raw_responses ?? null;
    row.status = payload.status ?? 'pending';
    row.score = payload.score ?? null;
    row.metadata = payload.metadata ?? null;
  }

  if (table === 'ananta_assessments') {
    row.domain = payload.domain ?? null;
    row.instrument_id = payload.instrument_id ?? null;
    row.instrument_version = payload.instrument_version ?? null;
    row.role = payload.role ?? null;
    row.raw_responses = payload.raw_responses ?? null;
    row.score = payload.score ?? null;
    row.metadata = payload.metadata ?? null;
  }

  if (table === 'ananta_feedback') {
    row.rating = payload.rating ?? null;
    row.comment = payload.comment ?? null;
  }

  store.push(row);
  return { data: row, error: null };
}

function rpcRecordConsent(db: ResearchTestDb): FakeResult {
  try {
    const userId = db.authUserId;
    if (userId === null || userId === undefined) {
      throw authError();
    }

    const existing = db.enrollments.find(enrollment => enrollment.user_id === userId);
    if (existing === undefined) {
      const result = insertRow(db, 'ananta_enrollments', {
        user_id: userId,
        consent_status: 'consented',
        consent_signed_at: new Date().toISOString(),
      });
      if (result.error !== null) {
        return result;
      }
      return { data: enrollmentJson(result.data as Row), error: null };
    }

    existing.consent_status = 'consented';
    existing.consent_signed_at = new Date().toISOString();
    existing.updated_at = new Date().toISOString();
    return { data: enrollmentJson(existing as unknown as Row), error: null };
  } catch (error) {
    return { data: null, error: error as FakeError };
  }
}

function rpcBeginResearch(db: ResearchTestDb): FakeResult {
  try {
    const enrollment = requireAuth(db);
    requireConsent(db, enrollment);
    if (enrollment.workflow_phase === 'NOT_STARTED') {
      enrollment.workflow_phase = 'DOMAIN_DISCOVERY';
      enrollment.updated_at = new Date().toISOString();
    }
    return { data: enrollmentJson(enrollment), error: null };
  } catch (error) {
    return { data: null, error: error as FakeError };
  }
}

function rpcRecordScreening(db: ResearchTestDb, args: Record<string, unknown>): FakeResult {
  try {
    const enrollment = requireAuth(db);
    requireConsent(db, enrollment);
    if (enrollment.workflow_phase !== 'DOMAIN_DISCOVERY') {
      throw protocolError('ananta_record_screening', 'screening available only during domain discovery');
    }

    const participantId = enrollment.id as string;
    if (db.screenings.some(screening => screening.participant_id === participantId)) {
      return { data: null, error: uniqueError('ananta_screenings', ['participant_id']) };
    }

    const result = insertRow(db, 'ananta_screenings', {
      participant_id: participantId,
      instrument_id: args.p_instrument_id as string,
      instrument_version: args.p_instrument_version as string,
      raw_responses: args.p_raw_responses ?? null,
      completed_at:
        (args.p_completed_at as string | undefined) ?? new Date().toISOString(),
      metadata: (args.p_metadata as Record<string, unknown> | null) ?? null,
      status: 'pending',
      score: null,
    });
    if (result.error !== null) {
      return result;
    }
    return { data: screeningView(result.data as ScreeningStoreRow), error: null };
  } catch (error) {
    return { data: null, error: error as FakeError };
  }
}

function rpcConfirmDomain(db: ResearchTestDb, args: Record<string, unknown>): FakeResult {
  try {
    const enrollment = requireAuth(db);
    requireConsent(db, enrollment);
    if (enrollment.workflow_phase !== 'DOMAIN_DISCOVERY') {
      throw protocolError('ananta_confirm_domain', 'domain confirmation requires the discovery phase');
    }

    const candidate = args.p_domain;
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      throw protocolError('ananta_confirm_domain', 'a non-empty domain is required');
    }

    const participantId = enrollment.id as string;
    const screening = db.screenings.find(row => row.participant_id === participantId);
    if (screening === undefined || screening.status !== 'eligible') {
      throw protocolError('ananta_confirm_domain', 'a valid screening result is required');
    }

    enrollment.workflow_phase = 'DOMAIN_CONFIRMED';
    enrollment.confirmed_domain = candidate;
    enrollment.updated_at = new Date().toISOString();
    return { data: enrollmentJson(enrollment), error: null };
  } catch (error) {
    return { data: null, error: error as FakeError };
  }
}

function rpcBeginBaseline(db: ResearchTestDb): FakeResult {
  try {
    const enrollment = requireAuth(db);
    requireConsent(db, enrollment);
    if (enrollment.workflow_phase !== 'DOMAIN_CONFIRMED' || enrollment.confirmed_domain === null) {
      throw protocolError('ananta_begin_baseline', 'baseline requires a confirmed research domain');
    }
    enrollment.workflow_phase = 'BASELINE_PENDING';
    enrollment.updated_at = new Date().toISOString();
    return { data: enrollmentJson(enrollment), error: null };
  } catch (error) {
    return { data: null, error: error as FakeError };
  }
}

function rpcRecordAssessment(db: ResearchTestDb, args: Record<string, unknown>): FakeResult {
  try {
    const enrollment = requireAuth(db);
    requireConsent(db, enrollment);
    const role = args.p_role as string;
    if (role !== 'pre' && role !== 'post') {
      throw protocolError('ananta_record_assessment', 'invalid role');
    }

    const confirmedDomain = enrollment.confirmed_domain as string | null;
    if (confirmedDomain === null) {
      throw protocolError('ananta_record_assessment', 'a confirmed domain is required');
    }
    if (args.p_domain !== confirmedDomain) {
      throw protocolError('ananta_record_assessment', 'domain must match the confirmed research domain');
    }

    if (role === 'pre' && enrollment.workflow_phase !== 'BASELINE_PENDING') {
      throw protocolError('ananta_record_assessment', 'the pre assessment requires the baseline pending phase');
    }
    if (role === 'post') {
      if (enrollment.workflow_phase !== 'SESSIONS_ACTIVE') {
        throw protocolError('ananta_record_assessment', 'the post assessment requires sessions to have started');
      }
      const third = db.sessions.find(
        session => session.participant_id === (enrollment.id as string) && session.session_number === 3,
      );
      if (third === undefined || third.status !== 'COMPLETED') {
        throw protocolError('ananta_record_assessment', 'the post assessment requires a completed session 3');
      }
    }

    const participantId = enrollment.id as string;
    if (db.assessments.some(assessment => assessment.participant_id === participantId && assessment.role === role)) {
      return { data: null, error: uniqueError('ananta_assessments', ['participant_id', 'role']) };
    }

    const result = insertRow(db, 'ananta_assessments', {
      participant_id: participantId,
      domain: args.p_domain as string,
      instrument_id: args.p_instrument_id as string,
      instrument_version: args.p_instrument_version as string,
      role,
      raw_responses: args.p_raw_responses ?? null,
      score: null,
      completed_at: (args.p_completed_at as string | undefined) ?? new Date().toISOString(),
      metadata: (args.p_metadata as Record<string, unknown> | null) ?? null,
    });
    if (result.error !== null) {
      return result;
    }

    if (role === 'pre') {
      enrollment.workflow_phase = 'BASELINE_COMPLETED';
      enrollment.updated_at = new Date().toISOString();
    }

    return {
      data: {
        assessment: result.data,
        enrollment: enrollmentJson(enrollment),
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error as FakeError };
  }
}

function rpcStartSession(db: ResearchTestDb, args: Record<string, unknown>): FakeResult {
  try {
    const enrollment = requireAuth(db);
    requireConsent(db, enrollment);
    const sessionNumber = args.p_session_number as number;
    if (!Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > 3) {
      throw protocolError('ananta_start_session', 'session number must be between 1 and 3');
    }

    const confirmedDomain = enrollment.confirmed_domain as string | null;
    if (confirmedDomain === null) {
      throw protocolError('ananta_start_session', 'a confirmed research domain is required');
    }

    const participantId = enrollment.id as string;
    if (sessionNumber === 1) {
      if (enrollment.workflow_phase !== 'BASELINE_COMPLETED') {
        throw protocolError('ananta_start_session', 'session 1 requires a completed baseline');
      }
      enrollment.workflow_phase = 'SESSIONS_ACTIVE';
      enrollment.updated_at = new Date().toISOString();
    } else {
      const previousNumber = sessionNumber - 1;
      const previous = db.sessions.find(
        session => session.participant_id === participantId && session.session_number === previousNumber,
      );
      if (previous === undefined || previous.status !== 'COMPLETED') {
        throw protocolError(
          'ananta_start_session',
          `session ${sessionNumber} requires completed session ${previousNumber}`,
        );
      }
    }

    if (db.sessions.some(session => session.participant_id === participantId && session.session_number === sessionNumber)) {
      return { data: null, error: uniqueError('ananta_sessions', ['participant_id', 'session_number']) };
    }

    const result = insertRow(db, 'ananta_sessions', {
      participant_id: participantId,
      session_number: sessionNumber,
      status: 'OPENING',
      domain_snapshot: confirmedDomain,
      started_at: new Date().toISOString(),
    });
    if (result.error !== null) {
      return result;
    }

    return {
      data: {
        session: result.data,
        enrollment: enrollmentJson(enrollment),
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error as FakeError };
  }
}

function ownSession(db: ResearchTestDb, sessionId: string): SessionRow {
  const session = db.sessions.find(row => row.id === sessionId);
  if (session === undefined) {
    throw protocolError('ananta_session', 'session not found or not owned');
  }
  const enrollment = db.enrollments.find(row => row.id === session.participant_id);
  if (enrollment === undefined || enrollment.user_id !== db.authUserId) {
    throw protocolError('ananta_session', 'session not found or not owned');
  }
  return session;
}

function rpcAdvanceSession(db: ResearchTestDb, args: Record<string, unknown>): FakeResult {
  try {
    const session = ownSession(db, args.p_session_id as string);
    if (session.status === 'OPENING') {
      session.status = 'ACTIVE';
    } else if (session.status === 'ACTIVE') {
      session.status = 'CLOSING';
    } else {
      throw protocolError('ananta_advance_session', `cannot advance from the ${session.status} phase`);
    }
    session.updated_at = new Date().toISOString();
    return { data: session, error: null };
  } catch (error) {
    return { data: null, error: error as FakeError };
  }
}

function rpcCompleteSession(db: ResearchTestDb, args: Record<string, unknown>): FakeResult {
  try {
    const session = ownSession(db, args.p_session_id as string);
    if (session.status !== 'CLOSING') {
      throw protocolError('ananta_complete_session', 'session must be closing before completion');
    }
    session.status = 'COMPLETED';
    session.summary = (args.p_summary as SessionRow['summary']) ?? null;
    session.completed_at = new Date().toISOString();
    session.updated_at = new Date().toISOString();
    return { data: session, error: null };
  } catch (error) {
    return { data: null, error: error as FakeError };
  }
}

function rpcAppendTranscript(db: ResearchTestDb, args: Record<string, unknown>): FakeResult {
  try {
    const session = ownSession(db, args.p_session_id as string);

    const existing = db.transcripts.filter(transcript => transcript.session_id === session.id);
    const maxSequence = existing.reduce(
      (max, transcript) => Math.max(max, transcript.sequence_number),
      0,
    );
    const row: TranscriptRow = {
      id: nextId(),
      session_id: session.id,
      sequence_number: maxSequence + 1,
      role: args.p_role as string,
      content: args.p_content as string,
      created_at: (args.p_created_at as string | undefined) ?? new Date().toISOString(),
      metadata: (args.p_metadata as Record<string, unknown> | undefined) ?? {},
    };
    db.transcripts.push(row);
    return { data: row, error: null };
  } catch (error) {
    return { data: null, error: error as FakeError };
  }
}

export function createFakeSupabaseClient(db: ResearchTestDb): SupabaseClient {
  const fake = {
    from(table: string): FakePostgrestBuilder {
      return new FakePostgrestBuilder(db, table);
    },
    rpc(name: string, args: Record<string, unknown> = {}): FakeResult {
      switch (name) {
        case 'ananta_record_consent':
          return rpcRecordConsent(db);
        case 'ananta_begin_research':
          return rpcBeginResearch(db);
        case 'ananta_record_screening':
          return rpcRecordScreening(db, args);
        case 'ananta_confirm_domain':
          return rpcConfirmDomain(db, args);
        case 'ananta_begin_baseline':
          return rpcBeginBaseline(db);
        case 'ananta_record_assessment':
          return rpcRecordAssessment(db, args);
        case 'ananta_start_session':
          return rpcStartSession(db, args);
        case 'ananta_advance_session':
          return rpcAdvanceSession(db, args);
        case 'ananta_complete_session':
          return rpcCompleteSession(db, args);
        case 'ananta_append_transcript':
          return rpcAppendTranscript(db, args);
        default:
          return {
            data: null,
            error: {
              code: 'not-implemented',
              message: `fake supabase: unknown rpc ${name}`,
              details: '',
            },
          };
      }
    },
  };

  return fake as unknown as SupabaseClient;
}

export function createFailOnMethod(
  base: ResearchPersistence,
  method: keyof ResearchPersistence,
): ResearchPersistence {
  let armed = true;

  return new Proxy(base, {
    get(target, prop: string | symbol, receiver) {
      if (prop === method && armed && typeof method === 'string') {
        armed = false;
        return (..._args: unknown[]): never => {
          throw new Error(`injected persistence failure for ${method}`);
        };
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
}

// ---- Fixture builders ------------------------------------------------------

export function makeEnrollmentRow(overrides: Partial<EnrollmentRow> = {}): EnrollmentRow {
  return {
    id: nextId(),
    user_id: nextId(),
    consent_status: 'none',
    consent_signed_at: null,
    workflow_phase: 'NOT_STARTED',
    confirmed_domain: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeBaselineSubmission(overrides: Partial<AssessmentSubmission> = {}): AssessmentSubmission {
  return {
    role: 'pre',
    domain: 'work-life balance',
    instrument_id: 'baseline-pre',
    instrument_version: 'v1',
    raw_responses: { q1: 2, q2: 2, q3: 3 },
    completed_at: '2026-09-15T00:00:00.000Z',
    metadata: { instrument: 'baseline-pre' },
    ...overrides,
  };
}

export function makeAssessmentRow(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: nextId(),
    participant_id: nextId(),
    domain: 'work-life balance',
    instrument_id: 'baseline-pre',
    instrument_version: 'v1',
    role: 'pre',
    raw_responses: null,
    score: null,
    completed_at: '2026-09-15T00:00:00.000Z',
    metadata: null,
    ...overrides,
  };
}

export function makeScreeningSubmission(
  overrides: Partial<ScreeningSubmission> = {},
): ScreeningSubmission {
  return {
    instrument_id: 'adss-v1',
    instrument_version: '1.0.0',
    raw_responses: { q1: 2, q2: 3 },
    completed_at: '2026-09-16T00:00:00.000Z',
    metadata: null,
    ...overrides,
  };
}

export function makeScreeningRow(overrides: Partial<ScreeningRow> = {}): ScreeningRow {
  return {
    id: nextId(),
    participant_id: nextId(),
    instrument_id: 'adss-v1',
    instrument_version: '1.0.0',
    status: 'pending',
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeSessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: nextId(),
    participant_id: nextId(),
    session_number: 1,
    status: 'NOT_STARTED',
    domain_snapshot: null,
    started_at: null,
    completed_at: null,
    summary: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createFakeDatabase(): ResearchTestDb {
  return {
    enrollments: [],
    assessments: [],
    sessions: [],
    screenings: [],
    transcripts: [],
    feedback: [],
    authUserId: null,
  };
}

export function setFakeAuthUser(db: ResearchTestDb, userId: string): void {
  db.authUserId = userId;
}

// Simulates the staff / service_role resolution path that participants can
// never call directly: marks a screening eligible or not_eligible.
export function resolveScreeningForTest(
  db: ResearchTestDb,
  participantId: string,
  status: ScreeningStatus,
  score: unknown = null,
): void {
  const row = db.screenings.find(screening => screening.participant_id === participantId);
  if (row === undefined) {
    throw new Error('no screening row exists for the participant');
  }
  row.status = status;
  row.score = score;
}