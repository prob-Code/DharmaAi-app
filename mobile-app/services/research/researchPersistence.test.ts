import {
  createResearchPersistence,
  isUniqueViolation,
  type ResearchPersistence,
} from './researchPersistence';
import {
  createFakeDatabase,
  createFakeSupabaseClient,
  makeScreeningSubmission,
  resolveScreeningForTest,
  setFakeAuthUser,
  type ResearchTestDb,
} from './researchTestHarness';
import { createInitialSessionSummary, type SessionSummary } from '../companion/sessionSummary';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

class Harness {
  readonly persistence: ResearchPersistence;
  readonly db: ResearchTestDb;
  readonly userId: string;

  constructor(userId: string) {
    const db = createFakeDatabase();
    setFakeAuthUser(db, userId);
    this.persistence = createResearchPersistence(createFakeSupabaseClient(db));
    this.db = db;
    this.userId = userId;
  }

  async participantId(): Promise<string> {
    const enrollment = await this.persistence.loadResearchEnrollment(this.userId);
    if (enrollment === null) {
      throw new Error('no enrollment for harness user');
    }
    return enrollment.id;
  }
}

async function expectThrows(
  operation: () => Promise<unknown>,
  message: string,
): Promise<void> {
  let didThrow = false;
  try {
    await operation();
  } catch {
    didThrow = true;
  }
  assert(didThrow, message);
}

function makeSummary(sessionNumber: number = 1): SessionSummary {
  return createInitialSessionSummary({
    sessionNumber,
    researchDomain: 'work-life balance',
    keyConcerns: ['stress at work'],
  });
}

async function consentAndDiscover(h: Harness): Promise<void> {
  await h.persistence.recordConsent();
  await h.persistence.beginResearch();
}

async function eligibleParticipant(h: Harness): Promise<void> {
  await consentAndDiscover(h);
  await h.persistence.recordScreening(makeScreeningSubmission());
  resolveScreeningForTest(h.db, await h.participantId(), 'eligible');
  await h.persistence.confirmDomain('work-life balance');
}

async function baselineCompleted(h: Harness): Promise<void> {
  await eligibleParticipant(h);
  await h.persistence.beginBaseline();
  await h.persistence.recordAssessment({
    role: 'pre',
    domain: 'work-life balance',
    instrument_id: 'baseline-pre',
    instrument_version: 'v1',
    raw_responses: { q1: 1 },
    completed_at: '2026-09-15T00:00:00.000Z',
    metadata: null,
  });
}

async function runSessionFlow(h: Harness, sessionNumber: number): Promise<void> {
  const state = await h.persistence.loadCurrentResearchState(h.userId);
  const row = state?.sessions.find(session => session.session_number === sessionNumber);
  if (row === undefined) {
    throw new Error(`no session ${sessionNumber} row found`);
  }
  await h.persistence.advanceSession(row.id);
  await h.persistence.advanceSession(row.id);
  await h.persistence.completeSession(row.id, makeSummary(sessionNumber));
}

export async function runResearchPersistenceTests(): Promise<void> {
  // ---- Consent and enrollment ---------------------------------------------
  {
    const h = new Harness('user-1');

    const missing = await h.persistence.loadResearchEnrollment('user-1');
    assert(missing === null, 'missing enrollment should load as null');

    const consented = await h.persistence.recordConsent();
    assert(consented.consent_status === 'consented', 'recordConsent should set consent');
    assert(consented.workflow_phase === 'NOT_STARTED', 'consent should not start the workflow');
    assert(
      !('research_code' in consented),
      'consent responses must not expose the restricted research_code column',
    );
    assert(h.db.enrollments.length === 1, 'recordConsent should create one enrollment row');

    const consentedAgain = await h.persistence.recordConsent();
    assert(consentedAgain.consent_status === 'consented', 're-consent should remain consented');
    assert(h.db.enrollments.length === 1, 're-consent should not duplicate the enrollment');
  }

  // ---- Consent gates research; beginResearch is idempotent -----------------
  {
    const h = new Harness('user-2');
    await h.persistence.recordConsent();
    h.db.enrollments[0].consent_status = 'none';
    await expectThrows(
      () => h.persistence.beginResearch(),
      'beginResearch without consent should be rejected',
    );

    h.db.enrollments[0].consent_status = 'consented';
    const discovery = await h.persistence.beginResearch();
    assert(discovery.workflow_phase === 'DOMAIN_DISCOVERY', 'beginResearch should open discovery');
    const again = await h.persistence.beginResearch();
    assert(again.workflow_phase === 'DOMAIN_DISCOVERY', 'beginResearch should be idempotent');
  }

  // ---- Screening gate + frozen domain --------------------------------------
  {
    const h = new Harness('user-3');
    await consentAndDiscover(h);
    await expectThrows(
      () => h.persistence.confirmDomain('work-life balance'),
      'confirmDomain before any screening should be rejected',
    );

    const screening = await h.persistence.recordScreening(makeScreeningSubmission());
    assert(screening.status === 'pending', 'submitted screening should start as pending');
    assert(
      !('score' in screening),
      'participant screening reads must not expose the restricted score column',
    );
    assert(
      !('raw_responses' in screening),
      'participant screening reads must not expose raw responses back',
    );
    assert(h.db.screenings.length === 1, 'screening should be persisted once');

    await expectThrows(
      () => h.persistence.recordScreening(makeScreeningSubmission()),
      'a second screening submission should be rejected',
    );

    await expectThrows(
      () => h.persistence.confirmDomain('work-life balance'),
      'confirmDomain with an unresolved screening should be rejected',
    );

    resolveScreeningForTest(h.db, await h.participantId(), 'eligible', { total: 7 });

    const confirmed = await h.persistence.confirmDomain('work-life balance');
    assert(confirmed.workflow_phase === 'DOMAIN_CONFIRMED', 'eligible screening should allow confirmation');
    assert(confirmed.confirmed_domain === 'work-life balance', 'confirmation should freeze the domain');

    await expectThrows(
      () => h.persistence.confirmDomain('a different domain'),
      'the frozen domain must never change',
    );
  }

  // ---- Not-eligible screening blocks the protocol --------------------------
  {
    const h = new Harness('user-4');
    await consentAndDiscover(h);
    await h.persistence.recordScreening(makeScreeningSubmission());
    resolveScreeningForTest(h.db, await h.participantId(), 'not_eligible');
    await expectThrows(
      () => h.persistence.confirmDomain('work-life balance'),
      'a not-eligible screening must block domain confirmation',
    );
  }

  // ---- Pre assessment gating + score not trusted ---------------------------
  {
    const h = new Harness('user-5');
    await h.persistence.beginBaseline().then(
      () => {
        throw new Error('beginBaseline before domain confirmation should be rejected');
      },
      () => undefined,
    );

    await eligibleParticipant(h);
    await expectThrows(
      () =>
        h.persistence.recordAssessment({
          role: 'pre',
          domain: 'work-life balance',
          instrument_id: 'baseline-pre',
          instrument_version: 'v1',
          raw_responses: { q1: 1 },
          completed_at: '2026-09-15T00:00:00.000Z',
          metadata: null,
        }),
      'pre assessment before the baseline window should be rejected',
    );

    await h.persistence.beginBaseline();
    await expectThrows(
      () =>
        h.persistence.recordAssessment({
          role: 'pre',
          domain: 'a different domain',
          instrument_id: 'baseline-pre',
          instrument_version: 'v1',
          raw_responses: { q1: 1 },
          completed_at: '2026-09-15T00:00:00.000Z',
          metadata: null,
        }),
      'pre assessment with a mismatched domain should be rejected',
    );

    const pre = await h.persistence.recordAssessment({
      role: 'pre',
      domain: 'work-life balance',
      instrument_id: 'baseline-pre',
      instrument_version: 'v1',
      raw_responses: { q1: 1, q2: 2 },
      completed_at: '2026-09-15T00:00:00.000Z',
      metadata: null,
    });
    assert(pre.assessment.role === 'pre', 'pre assessment should be stored');
    assert(pre.assessment.score === null, 'participant assessments must record a null score');
    assert(pre.assessment.raw_responses !== null, 'raw responses should be stored');
    assert(pre.enrollment.workflow_phase === 'BASELINE_COMPLETED', 'pre assessment should close the baseline window');

    await expectThrows(
      () =>
        h.persistence.recordAssessment({
          role: 'pre',
          domain: 'work-life balance',
          instrument_id: 'baseline-pre',
          instrument_version: 'v1',
          raw_responses: { q1: 3 },
          completed_at: '2026-09-15T00:00:00.000Z',
          metadata: null,
        }),
      'a second pre assessment should be a unique violation',
    );
    assert(h.db.assessments.length === 1, 'duplicate pre assessment must not insert a second row');
  }

  // ---- Post assessment requires a completed session 3 ----------------------
  {
    const h = new Harness('user-6');
    const post = {
      role: 'post' as const,
      domain: 'work-life balance',
      instrument_id: 'baseline-post',
      instrument_version: 'v1',
      raw_responses: { q1: 4 },
      completed_at: '2026-10-01T00:00:00.000Z',
      metadata: null,
    };

    await expectThrows(
      () => h.persistence.recordAssessment(post),
      'post assessment before any enrollment should be rejected',
    );

    await baselineCompleted(h);
    await h.persistence.startSession(1);
    await expectThrows(
      () => h.persistence.recordAssessment(post),
      'post assessment after only session 1 should be rejected',
    );

    await runSessionFlow(h, 1);
    await h.persistence.startSession(2);
    await runSessionFlow(h, 2);
    await h.persistence.startSession(3);
    await runSessionFlow(h, 3);

    const postResult = await h.persistence.recordAssessment(post);
    assert(postResult.assessment.role === 'post', 'post assessment should be stored after session 3');
    assert(postResult.assessment.score === null, 'post assessment score must not be trusted from the client');
    assert(h.db.assessments.length === 2, 'exactly one pre and one post assessment should exist');
  }

  // ---- Session gating: 1 then 2 then 3, one row each ------------------------
  {
    const h = new Harness('user-7');
    await expectThrows(
      () => h.persistence.startSession(1),
      'session 1 before the baseline completes should be rejected',
    );

    await baselineCompleted(h);

    const sessionOne = await h.persistence.startSession(1);
    assert(sessionOne.session.status === 'OPENING', 'session 1 should open on start');
    assert(sessionOne.session.session_number === 1, 'session 1 should carry its number');
    assert(
      sessionOne.session.domain_snapshot === 'work-life balance',
      'session 1 should snapshot the frozen domain',
    );
    assert(sessionOne.session.started_at !== null, 'session 1 should carry a start time');
    assert(sessionOne.enrollment.workflow_phase === 'SESSIONS_ACTIVE', 'starting session 1 should activate sessions');

    await expectThrows(
      () => h.persistence.startSession(2),
      'session 2 must not open before session 1 completes',
    );
    await expectThrows(
      () => h.persistence.startSession(3),
      'session 3 must not open before sessions 1 and 2 complete',
    );

    await runSessionFlow(h, 1);

    const sessionTwo = await h.persistence.startSession(2);
    assert(sessionTwo.session.session_number === 2, 'session 2 should carry its number');
    assert(
      sessionTwo.session.domain_snapshot === 'work-life balance',
      'session 2 should reuse the frozen domain snapshot',
    );

    await expectThrows(
      () => h.persistence.startSession(3),
      'session 3 must not open before session 2 completes',
    );

    await runSessionFlow(h, 2);
    const sessionThree = await h.persistence.startSession(3);
    assert(sessionThree.session.session_number === 3, 'session 3 should carry its number');
    assert(
      h.db.sessions.filter(row => row.participant_id === sessionThree.session.participant_id).length === 3,
      'there should be exactly one row per participant/session',
    );

    let outOfRangeRejected = false;
    try {
      await h.persistence.startSession(4);
    } catch {
      outOfRangeRejected = true;
    }
    assert(outOfRangeRejected, 'session numbers outside 1..3 must be rejected');

    await expectThrows(
      () => h.persistence.startSession(1),
      're-opening session 1 must be a unique violation',
    );
  }

  // ---- Session phase transitions are strictly ordered -----------------------
  {
    const h = new Harness('user-8');
    await baselineCompleted(h);
    const { session } = await h.persistence.startSession(1);

    await expectThrows(
      () => h.persistence.completeSession(session.id, makeSummary(1)),
      'a session cannot be completed from the OPENING phase',
    );

    const active = await h.persistence.advanceSession(session.id);
    assert(active.status === 'ACTIVE', 'advance from OPENING should reach ACTIVE');

    const closing = await h.persistence.advanceSession(session.id);
    assert(closing.status === 'CLOSING', 'advance from ACTIVE should reach CLOSING');

    await expectThrows(
      () => h.persistence.advanceSession(session.id),
      'advancing from CLOSING must be rejected',
    );

    const completed = await h.persistence.completeSession(session.id, makeSummary(1));
    assert(completed.status === 'COMPLETED', 'completion should finish the session');
    assert(completed.completed_at !== null, 'completion should timestamp the session');
    assert(
      completed.summary?.keyConcerns[0] === 'stress at work',
      'completion should persist the summary',
    );

    await expectThrows(
      () => h.persistence.completeSession(session.id, makeSummary(1)),
      'a COMPLETED session cannot be completed again',
    );

    await expectThrows(
      () => h.persistence.advanceSession('missing-session'),
      'advancing a missing session must be rejected',
    );
  }

  // ---- Transcripts (ownership checked) ---------------------------------------
  {
    const h = new Harness('user-9');
    await baselineCompleted(h);
    const { session } = await h.persistence.startSession(1);

    const first = await h.persistence.appendTranscriptEvent(session.id, 'user', 'hello there');
    const second = await h.persistence.appendTranscriptEvent(
      session.id,
      'companion',
      'hi',
      '2026-09-16T10:00:00.000Z',
      { source: 'harness' },
    );
    assert(first.sequence_number === 1, 'first transcript event should get sequence 1');
    assert(second.sequence_number === 2, 'second transcript event should get sequence 2');
    assert(second.created_at === '2026-09-16T10:00:00.000Z', 'transcript should honor the supplied timestamp');
    assert(h.db.transcripts.length === 2, 'transcript events should reach the store');

    await expectThrows(
      () => h.persistence.appendTranscriptEvent('missing-session', 'user', 'stray'),
      'appending to a missing session should reject',
    );

    const stranger = new Harness('someone-else');
    stranger.db.enrollments = h.db.enrollments;
    stranger.db.sessions = h.db.sessions;
    await expectThrows(
      () => stranger.persistence.appendTranscriptEvent(session.id, 'user', 'stray'),
      'cross-owner transcript appends must be rejected',
    );
  }

  // ---- Feedback -----------------------------------------------------------------
  {
    const h = new Harness('user-10');
    const enrollment = await h.persistence.recordConsent();
    const feedback = await h.persistence.persistFeedback({
      participant_id: enrollment.id,
      session_id: null,
      category: 'companion',
      rating: 4,
      comment: 'calm',
    });
    assert(feedback.id.length > 0, 'feedback should return the persisted row');
    assert(h.db.feedback.length === 1, 'feedback should reach the store');
  }

  // ---- Read model -----------------------------------------------------------------
  {
    const h = new Harness('user-11');
    assert((await h.persistence.loadCurrentResearchState('user-11')) === null, 'read model should be null before enrollment');

    await baselineCompleted(h);
    await h.persistence.startSession(1);

    const state = await h.persistence.loadCurrentResearchState('user-11');
    assert(state !== null, 'read model should exist once an enrollment exists');
    assert(state?.enrollment.workflow_phase === 'SESSIONS_ACTIVE', 'read model should include the enrollment');
    assert(state?.baseline?.role === 'pre', 'read model should include the baseline assessment');
    assert(
      !('raw_responses' in state!.baseline!) && !('score' in state!.baseline!) && !('metadata' in state!.baseline!),
      'read model baseline must not expose the restricted assessment columns',
    );
    assert(state?.screening?.status === 'eligible', 'read model should include the resolved screening status');
    assert(state?.sessions.length === 1, 'read model should include the session rows');
    assert(state?.sessions[0].session_number === 1, 'read model sessions should be ordered by session number');
  }

  // ---- isUniqueViolation classification ---------------------------------------------
  assert(isUniqueViolation({ code: '23505', message: 'duplicate key value violates unique constraint "x_key"' }), 'code 23505 should classify as unique');
  assert(!isUniqueViolation({ code: '42P01', message: 'relation does not exist' }), 'non-unique errors should not classify as unique');
  assert(!isUniqueViolation(null), 'null should not classify as a unique violation');
  assert(!isUniqueViolation('some string'), 'strings should not classify as a unique violation');
}

runResearchPersistenceTests()
  .then(() => console.log('researchPersistence tests passed'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });