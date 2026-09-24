import type { SessionOrchestratorState } from '../companion/sessionOrchestrator';
import { createDefaultSessionState } from './researchMapping';
import { enrollmentRowToDomainDiscovery, enrollmentRowToWorkflow } from './researchMapping';
import { sessionRowToOrchestratorState } from './researchMapping';
import {
  makeEnrollmentRow,
  makeScreeningRow,
  makeSessionRow,
} from './researchTestHarness';
import type { ResearchWorkflowPhase } from '../companion/researchWorkflow';
import type { ScreeningRow } from './researchTypes';
import type { ResearchSnapshot } from './researchController';
import { resolveResearchGateStep } from './researchGate';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function makeSnapshot(overrides: {
  phase: ResearchWorkflowPhase;
  consentStatus?: string;
  confirmedDomain?: string | null;
  screening?: ScreeningRow | null;
  session?: SessionOrchestratorState;
}): ResearchSnapshot {
  const enrollment = makeEnrollmentRow({
    consent_status: (overrides.consentStatus ?? 'consented') as 'consented',
    workflow_phase: overrides.phase,
    confirmed_domain: overrides.confirmedDomain ?? null,
  });

  return {
    enrollment,
    workflow: enrollmentRowToWorkflow(enrollment),
    domainDiscovery: enrollmentRowToDomainDiscovery(enrollment),
    screening: overrides.screening ?? null,
    session: overrides.session ?? createDefaultSessionState(),
  };
}

function makeActiveSession(number: 1 | 2 | 3, status: string): SessionOrchestratorState {
  return sessionRowToOrchestratorState(
    makeSessionRow({
      session_number: number,
      status: status as 'ACTIVE',
      domain_snapshot: 'work-life balance',
    }),
  );
}

export function runResearchGateTests(): void {
  const domain = 'work-life balance';

  assert(
    resolveResearchGateStep('idle', null).step === 'hydrating',
    'idle should not expose a research view yet',
  );
  assert(
    resolveResearchGateStep('hydrating', null).step === 'hydrating',
    'hydrating should render the loading state',
  );
  assert(
    resolveResearchGateStep('unavailable', null).step === 'unavailable',
    'unavailable should surface the persistence boundary',
  );

  assert(
    resolveResearchGateStep('ready', null).step === 'consent',
    'no enrollment should require consent',
  );
  assert(
    resolveResearchGateStep(
      'ready',
      makeSnapshot({ phase: 'NOT_STARTED', consentStatus: 'none' }),
    ).step === 'consent',
    'unconsented enrollment should require consent',
  );

  assert(
    resolveResearchGateStep(
      'ready',
      makeSnapshot({ phase: 'NOT_STARTED', consentStatus: 'consented' }),
    ).step === 'entry',
    'consented unstarted participant should enter the research flow',
  );

  const discoverySnapshot = (screening: ScreeningRow | null) =>
    resolveResearchGateStep(
      'ready',
      makeSnapshot({ phase: 'DOMAIN_DISCOVERY', screening }),
    ).step;

  assert(
    discoverySnapshot(null) === 'screening',
    'missing screening should route to screening',
  );
  assert(
    discoverySnapshot(makeScreeningRow({ status: 'pending' })) === 'screening',
    'pending screening should remain on screening',
  );
  assert(
    discoverySnapshot(makeScreeningRow({ status: 'eligible' })) === 'domain_discovery',
    'eligible screening should open domain discovery',
  );
  assert(
    discoverySnapshot(makeScreeningRow({ status: 'not_eligible' })) === 'not_eligible',
    'ineligible screening should stop the flow',
  );

  assert(
    resolveResearchGateStep(
      'ready',
      makeSnapshot({ phase: 'DOMAIN_CONFIRMED', confirmedDomain: domain }),
    ).step === 'baseline_intro',
    'confirmed domain should introduce the baseline',
  );
  assert(
    resolveResearchGateStep(
      'ready',
      makeSnapshot({ phase: 'BASELINE_PENDING', confirmedDomain: domain }),
    ).step === 'baseline_pending',
    'baseline pending should keep the participant on the baseline',
  );
  assert(
    resolveResearchGateStep(
      'ready',
      makeSnapshot({ phase: 'BASELINE_COMPLETED', confirmedDomain: domain }),
    ).step === 'sessions_entry',
    'completed baseline should unlock session one',
  );

  const sessionsSnapshot = (session: SessionOrchestratorState) => {
    const resolved = resolveResearchGateStep(
      'ready',
      makeSnapshot({ phase: 'SESSIONS_ACTIVE', confirmedDomain: domain, session }),
    );
    assert(resolved.step === 'session_active', 'an in-progress session should open the chat');
    return resolved;
  };

  const activeSession = sessionsSnapshot(makeActiveSession(1, 'ACTIVE'));
  assert(activeSession.step === 'session_active', 'active session routes to chat');
  assert(
    activeSession.step === 'session_active' && activeSession.session.currentSessionNumber === 1,
    'routed session should come from the authoritative snapshot',
  );

  sessionsSnapshot(makeActiveSession(1, 'OPENING'));

  assert(
    resolveResearchGateStep(
      'ready',
      makeSnapshot({
        phase: 'SESSIONS_ACTIVE',
        confirmedDomain: domain,
        session: makeActiveSession(1, 'COMPLETED'),
      }),
    ).step === 'session_next',
    'a completed session below three should offer the next session',
  );

  assert(
    resolveResearchGateStep(
      'ready',
      makeSnapshot({
        phase: 'SESSIONS_ACTIVE',
        confirmedDomain: domain,
        session: makeActiveSession(2, 'COMPLETED'),
      }),
    ).step === 'session_next',
    'a completed session two should offer session three',
  );

  assert(
    resolveResearchGateStep(
      'ready',
      makeSnapshot({
        phase: 'SESSIONS_ACTIVE',
        confirmedDomain: domain,
        session: makeActiveSession(3, 'COMPLETED'),
      }),
    ).step === 'post_test',
    'completed session three should route to the post test',
  );
}

runResearchGateTests();
console.log('researchGate tests passed');