import { ParticipantResearchController, type ResearchSnapshot } from './researchController';
import { createResearchPersistence, type ResearchPersistence } from './researchPersistence';
import {
  createFailOnMethod,
  createFakeDatabase,
  createFakeSupabaseClient,
  makeBaselineSubmission,
  makeScreeningSubmission,
  resolveScreeningForTest,
  setFakeAuthUser,
  type ResearchTestDb,
} from './researchTestHarness';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createHarness(
  userId: string,
): { persistence: ResearchPersistence; db: ResearchTestDb } {
  const db = createFakeDatabase();
  setFakeAuthUser(db, userId);
  const persistence = createResearchPersistence(createFakeSupabaseClient(db));
  return { persistence, db };
}

function persistenceFor(db: ResearchTestDb): ResearchPersistence {
  return createResearchPersistence(createFakeSupabaseClient(db));
}

async function expectThrows(operation: () => Promise<unknown>, message: string): Promise<void> {
  let didThrow = false;
  try {
    await operation();
  } catch {
    didThrow = true;
  }
  assert(didThrow, message);
}

function requireEnrollmentId(controller: ParticipantResearchController): string {
  const id = controller.getEnrollmentId();
  assert(id !== null, 'expected an enrollment id');
  return id as string;
}

async function driveToEligible(
  controller: ParticipantResearchController,
  db: ResearchTestDb,
): Promise<void> {
  await controller.recordConsent();
  await controller.beginResearch();
  await controller.completeScreening(makeScreeningSubmission());
  resolveScreeningForTest(db, requireEnrollmentId(controller), 'eligible');
  await controller.hydrate();
}

async function driveToBaselineCompleted(
  controller: ParticipantResearchController,
  db: ResearchTestDb,
): Promise<void> {
  await driveToEligible(controller, db);
  await controller.confirmDomainCandidate('work-life balance', 'Work feels overwhelming.');
  await controller.beginBaseline();
  await controller.completeBaseline(makeBaselineSubmission());
}

async function driveToSessionOneOpen(
  controller: ParticipantResearchController,
  db: ResearchTestDb,
): Promise<void> {
  await driveToBaselineCompleted(controller, db);
  await controller.startSessionOne('standard');
}

async function completeCurrentSession(controller: ParticipantResearchController): Promise<void> {
  await controller.advanceActiveSession();
  await controller.advanceActiveSession();
  await controller.completeActiveSession({ keyConcerns: ['stress at work'] });
}

function postSubmission(domain: string, completedAt: string): {
  role: 'post';
  domain: string;
  instrument_id: string;
  instrument_version: string;
  raw_responses: unknown;
  completed_at: string;
  metadata: null;
} {
  return {
    role: 'post',
    domain,
    instrument_id: 'baseline-post',
    instrument_version: 'v1',
    raw_responses: { q1: 5 },
    completed_at: completedAt,
    metadata: null,
  };
}

export async function runResearchControllerTests(): Promise<void> {
  const domain = 'work-life balance';

  // ---- Fresh participant hydrates to an empty state -----------------------
  {
    const { persistence } = createHarness('fresh-user');
    const controller = new ParticipantResearchController('fresh-user', persistence);

    const snapshot = await controller.hydrate();
    assert(snapshot.enrollment === null, 'fresh participant should have no enrollment');
    assert(snapshot.workflow.phase === 'NOT_STARTED', 'fresh participant should start un-started');
    assert(snapshot.domainDiscovery.status === 'NOT_STARTED', 'fresh participant should have no discovery');
    assert(snapshot.screening === null, 'fresh participant should have no screening');
    assert(snapshot.session.sessionPhase === 'NOT_STARTED', 'fresh participant should have no active session');
    assert(controller.getEnrollmentId() === null, 'fresh participant id should resolve to null');
    assert(controller.getActiveSessionId() === null, 'fresh participant should have no active session id');
  }

  // ---- Consent gates every protocol entry point ---------------------------
  {
    const { persistence, db } = createHarness('consent-user');
    const controller = new ParticipantResearchController('consent-user', persistence);
    await controller.hydrate();

    await expectThrows(
      () => controller.beginResearch(),
      'beginResearch without consent should be rejected',
    );
    await expectThrows(
      () => controller.completeScreening(makeScreeningSubmission()),
      'screening without an enrollment should be rejected',
    );
    await expectThrows(
      () => controller.confirmDomainCandidate(domain, 'Work feels heavy.'),
      'domain confirmation without consent should be rejected',
    );

    const snapshot = await controller.recordConsent();
    assert(snapshot.enrollment?.consent_status === 'consented', 'recordConsent should persist consent');
    assert(snapshot.workflow.phase === 'NOT_STARTED', 'consent should not start the workflow');
    assert(db.enrollments.length === 1, 'recordConsent should create one enrollment');

    await controller.recordConsent();
    assert(db.enrollments.length === 1, 're-consent should not duplicate the enrollment');
  }

  // ---- Full protocol happy path + persistence verification ----------------
  {
    const { persistence, db } = createHarness('walkthrough-user');
    const controller = new ParticipantResearchController('walkthrough-user', persistence);
    let snapshot: ResearchSnapshot;

    await driveToEligible(controller, db);
    snapshot = controller.getSnapshot();
    assert(snapshot.workflow.phase === 'DOMAIN_DISCOVERY', 'consented beginResearch should open discovery');
    assert(snapshot.screening?.status === 'eligible', 'hydrated screening should reflect the staff resolution');

    snapshot = await controller.confirmDomainCandidate(domain, 'Work feels overwhelming.');
    assert(snapshot.workflow.phase === 'DOMAIN_CONFIRMED', 'confirming the domain should advance the workflow');
    assert(snapshot.workflow.confirmedResearchDomain === domain, 'the confirmed domain should freeze');
    assert(
      (db.enrollments[0] as { confirmed_domain: string | null }).confirmed_domain === domain,
      'the frozen domain should be persisted',
    );

    snapshot = await controller.beginBaseline();
    assert(snapshot.workflow.phase === 'BASELINE_PENDING', 'beginBaseline should open the baseline window');

    const baselineSubmission = makeBaselineSubmission();
    snapshot = await controller.completeBaseline(baselineSubmission);
    assert(snapshot.workflow.phase === 'BASELINE_COMPLETED', 'completing the baseline should advance');
    assert(snapshot.workflow.baselineAssessment?.researchDomain === domain, 'the completed baseline should carry the frozen domain');
    assert(db.assessments.length === 1, 'the baseline record should be persisted');
    assert(
      (db.assessments[0] as { raw_responses: { q1: number } | null }).raw_responses?.q1 === 2,
      'the persisted baseline must carry the participant raw responses',
    );
    assert(
      (db.assessments[0] as { score: unknown }).score === null,
      'the persisted baseline score must stay null (never client-trusted)',
    );

    snapshot = await controller.startSessionOne('standard');
    assert(snapshot.workflow.phase === 'SESSIONS_ACTIVE', 'starting session one should activate sessions');
    assert(snapshot.session.sessionPhase === 'OPENING', 'session one should open on start');
    assert(
      snapshot.session.conversationState.researchDomain === domain,
      'the opened session should carry the frozen domain',
    );
    assert(controller.getActiveSessionId() !== null, 'an opened session should expose its id');
    assert(db.sessions.length === 1, 'starting session one should persist one row');
    assert(
      (db.sessions[0] as { domain_snapshot: string }).domain_snapshot === domain,
      'the persisted session should snapshot the domain',
    );

    const sessionOneId = controller.getActiveSessionId();

    snapshot = await controller.advanceActiveSession();
    assert(snapshot.session.sessionPhase === 'ACTIVE', 'first advance should reach ACTIVE');
    assert(
      (db.sessions[0] as { status: string }).status === 'ACTIVE',
      'advancing should persist the ACTIVE status',
    );

    const firstEvent = await controller.appendTranscript('user', 'I have been very stressed at work.');
    assert(firstEvent.sequence_number === 1, 'first transcript event should be sequenced first');
    await controller.appendTranscript('companion', 'That sounds exhausting.');
    assert(db.transcripts.length === 2, 'transcript events should reach the store');

    snapshot = await controller.advanceActiveSession();
    assert(snapshot.session.sessionPhase === 'CLOSING', 'second advance should reach CLOSING');
    assert(
      (db.sessions[0] as { status: string }).status === 'CLOSING',
      'advancing should persist the CLOSING status',
    );

    const feedback = await controller.persistFeedback({
      category: 'session',
      rating: 5,
      comment: 'felt listened to',
    });
    assert(feedback.session_id === sessionOneId, 'feedback should attach to the in-progress session');
    assert(db.feedback.length === 1, 'feedback should reach the store');

    snapshot = await controller.completeActiveSession({ keyConcerns: ['stress at work'] });
    assert(snapshot.session.sessionPhase === 'COMPLETED', 'completing should finish the session');
    assert(controller.getActiveSessionId() === null, 'a completed session is no longer active');
    assert(
      (db.sessions[0] as { status: string }).status === 'COMPLETED',
      'completion should persist the COMPLETED status',
    );
    assert(
      (db.sessions[0] as { completed_at: string | null }).completed_at !== null,
      'completion should persist the completed timestamp',
    );

    snapshot = await controller.startNextSession('extended');
    assert(snapshot.session.currentSessionNumber === 2, 'the next session should be session two');
    assert(
      snapshot.session.conversationState.researchDomain === domain,
      'session two should carry the frozen domain forward',
    );
    assert(db.sessions.length === 2, 'session two should have its own persisted row');

    await completeCurrentSession(controller);
    assert(controller.getSnapshot().session.currentSessionNumber === 2, 'session two should complete as session two');

    // The post assessment is gated on a completed session 3.
    await expectThrows(
      () => controller.completePostAssessment(postSubmission(domain, '2026-10-01T00:00:00.000Z')),
      'post assessment after only session 2 must be rejected',
    );

    snapshot = await controller.startNextSession('brief');
    assert(snapshot.session.currentSessionNumber === 3, 'the final session should be session three');
    await completeCurrentSession(controller);
    assert(controller.getSnapshot().session.currentSessionNumber === 3, 'session three should complete as session three');
    assert(db.sessions.length === 3, 'all three sessions should be persisted');

    await expectThrows(
      () => controller.startNextSession('standard'),
      'no fourth session should be allowed',
    );
    await expectThrows(
      () => controller.appendTranscript('user', 'should not land'),
      'transcripts should not be appended after the protocol completes',
    );

    const postResult = await controller.completePostAssessment(postSubmission(domain, '2026-10-02T00:00:00.000Z'));
    assert(postResult.enrollment?.id === controller.getEnrollmentId(), 'post assessment should preserve the enrollment');
    assert(db.assessments.length === 2, 'the post assessment should be persisted');
    assert(
      (db.assessments[1] as { score: unknown }).score === null,
      'the persisted post score must stay null (never client-trusted)',
    );
  }

  // ---- Hydration reconstructs persisted state ------------------------------
  {
    const { persistence, db } = createHarness('rehydrate-user');
    const writer = new ParticipantResearchController('rehydrate-user', persistenceFor(db));
    await driveToSessionOneOpen(writer, db);
    await writer.advanceActiveSession();
    await writer.advanceActiveSession();
    await writer.completeActiveSession({ keyConcerns: ['stress at work'] });

    const reader = new ParticipantResearchController('rehydrate-user', persistence);
    const snapshot = await reader.hydrate();

    assert(snapshot.enrollment?.id === writer.getEnrollmentId(), 'hydrated enrollment should match');
    assert(snapshot.workflow.phase === 'SESSIONS_ACTIVE', 'hydrated workflow should be in sessions');
    assert(snapshot.workflow.confirmedResearchDomain === domain, 'hydrated workflow should freeze the domain');
    assert(
      snapshot.workflow.baselineAssessment?.researchDomain === domain,
      'hydrated workflow should restore the baseline record',
    );
    assert(snapshot.domainDiscovery.status === 'CONFIRMED', 'hydrated discovery should be confirmed');
    assert(snapshot.screening?.status === 'eligible', 'hydrated screening should restore the resolution');
    assert(snapshot.session.currentSessionNumber === 1, 'hydrated session should be session one');
    assert(snapshot.session.sessionPhase === 'COMPLETED', 'hydrated session should reflect completion');
    assert(
      snapshot.session.activeSummary?.keyConcerns[0] === 'stress at work',
      'hydrated session should restore the summary',
    );

    await expectThrows(
      () => reader.startSessionOne('standard'),
      'session one must not restart after hydration of a completed session',
    );
  }

  // ---- Invalid transitions throw without side effects ----------------------
  {
    const { persistence, db } = createHarness('strict-user');
    const controller = new ParticipantResearchController('strict-user', persistence);
    await controller.hydrate();

    await expectThrows(
      () => controller.beginBaseline(),
      'beginBaseline before consent should throw',
    );
    await expectThrows(
      () => controller.completeBaseline(makeBaselineSubmission()),
      'completeBaseline before consent should throw',
    );
    await expectThrows(
      () => controller.startSessionOne('standard'),
      'startSessionOne before consent should throw',
    );
    await expectThrows(
      () => controller.advanceActiveSession(),
      'advancing without a session should throw',
    );
    await expectThrows(
      () => controller.completeActiveSession(),
      'completing without a session should throw',
    );
    await expectThrows(
      () => controller.appendTranscript('user', 'stray'),
      'appending a transcript without a session should throw',
    );
    await expectThrows(
      () => controller.persistFeedback({ category: 'session' }),
      'feedback without an enrollment should throw',
    );
    assert(db.enrollments.length === 0, 'invalid transitions should not create enrollments');
    assert(db.sessions.length === 0, 'invalid transitions should not create sessions');
    assert(db.transcripts.length === 0, 'invalid transitions should not create transcripts');

    await controller.recordConsent();
    await controller.beginResearch();
    await expectThrows(
      () => controller.beginBaseline(),
      'beginBaseline before domain confirmation should throw',
    );

    await controller.completeScreening(makeScreeningSubmission());
    await expectThrows(
      () => controller.confirmDomainCandidate(domain, 'Work feels heavy.'),
      'domain confirmation before the screening resolves must throw',
    );
    resolveScreeningForTest(db, requireEnrollmentId(controller), 'eligible');
    await controller.hydrate();
    await controller.confirmDomainCandidate(domain, 'Work feels heavy.');
    await expectThrows(
      () => controller.confirmDomainCandidate('different domain', 'A new scenario.'),
      'the frozen domain must never change',
    );
    await expectThrows(
      () => controller.completeBaseline(makeBaselineSubmission()),
      'completeBaseline before the baseline window should throw',
    );
    await controller.beginBaseline();
    await expectThrows(
      () => controller.startSessionOne('standard'),
      'session one must not start before the baseline completes',
    );
    await expectThrows(
      () => controller.beginBaseline(),
      'beginBaseline twice should throw',
    );

    await controller.completeBaseline(makeBaselineSubmission());
    await expectThrows(
      () => controller.completeBaseline(makeBaselineSubmission()),
      'a second baseline completion should throw',
    );
    await expectThrows(
      () => controller.advanceActiveSession(),
      'advancing before a session opens should throw',
    );
    assert(db.assessments.length === 1, 'only one baseline should ever exist');
    assert(db.sessions.length === 0, 'no session should be created by invalid transitions');
  }

  // ---- Persist-first: failures leave the exposed state unchanged -----------
  {
    const { persistence, db } = createHarness('atomic-user');
    const drive = new ParticipantResearchController('atomic-user', persistence);
    await driveToEligible(drive, db);

    const failing = createFailOnMethod(persistence, 'confirmDomain');
    const controller = new ParticipantResearchController('atomic-user', failing);
    await controller.hydrate();

    await expectThrows(
      () => controller.confirmDomainCandidate(domain, 'Work feels heavy.'),
      'a failed domain persistence should reject',
    );

    const snapshot = controller.getSnapshot();
    assert(snapshot.workflow.phase === 'DOMAIN_DISCOVERY', 'failed confirmation must not advance the local workflow');
    assert(
      (db.enrollments[0] as { confirmed_domain: string | null }).confirmed_domain === null,
      'failed confirmation must not persist a domain',
    );
  }

  // ---- Atomic start: a failed start persists nothing; retry succeeds -------
  {
    const { persistence: base, db } = createHarness('atomic-start-user');
    const setup = new ParticipantResearchController('atomic-start-user', base);
    await driveToBaselineCompleted(setup, db);

    const failing = createFailOnMethod(base, 'startSession');
    const controller = new ParticipantResearchController('atomic-start-user', failing);
    await controller.hydrate();
    assert(
      controller.getSnapshot().workflow.phase === 'BASELINE_COMPLETED',
      'start controller should hydrate at baseline completed',
    );

    await expectThrows(
      () => controller.startSessionOne('standard'),
      'the start failure should reject the first attempt',
    );
    assert(db.sessions.length === 0, 'an atomic start failure must persist no session row');
    assert(
      controller.getSnapshot().workflow.phase === 'BASELINE_COMPLETED',
      'a failed start must not advance the local workflow',
    );

    await controller.startSessionOne('standard');
    assert(controller.getSnapshot().workflow.phase === 'SESSIONS_ACTIVE', 'retry should advance the workflow');
    assert(db.sessions.length === 1, 'retry should create exactly one session row');
    assert(
      controller.getActiveSessionId() === (db.sessions[0] as { id: string }).id,
      'retry should bind the created session row',
    );
  }

  // ---- Atomic assessment: a failed record persists nothing; retry succeeds --
  {
    const { persistence: base, db } = createHarness('atomic-assessment-user');
    const setup = new ParticipantResearchController('atomic-assessment-user', base);
    await driveToEligible(setup, db);
    await setup.confirmDomainCandidate(domain, 'Work feels heavy.');
    await setup.beginBaseline();

    const failing = createFailOnMethod(base, 'recordAssessment');
    const controller = new ParticipantResearchController('atomic-assessment-user', failing);
    await controller.hydrate();

    await expectThrows(
      () => controller.completeBaseline(makeBaselineSubmission()),
      'the assessment failure should reject the first attempt',
    );
    assert(db.assessments.length === 0, 'an atomic assessment failure must persist no row');
    assert(
      controller.getSnapshot().workflow.phase === 'BASELINE_PENDING',
      'a failed assessment must not advance the local workflow',
    );

    await controller.completeBaseline(makeBaselineSubmission());
    assert(controller.getSnapshot().workflow.phase === 'BASELINE_COMPLETED', 'retry should advance the workflow');
    assert(db.assessments.length === 1, 'retry should create exactly one assessment row');
  }
}

runResearchControllerTests()
  .then(() => console.log('researchController tests passed'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });