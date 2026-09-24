import type { SessionOrchestratorState } from '../companion/sessionOrchestrator';
import type { ResearchSnapshot } from './researchController';
import type { ResearchHydrationStatus } from './useParticipantResearch';

export type ResearchGateStep =
  | { step: 'hydrating' }
  | { step: 'unavailable' }
  | { step: 'consent' }
  | { step: 'entry' }
  | { step: 'screening' }
  | { step: 'not_eligible' }
  | { step: 'domain_discovery' }
  | { step: 'baseline_intro' }
  | { step: 'baseline_pending' }
  | { step: 'sessions_entry' }
  | { step: 'session_next' }
  | { step: 'session_active'; session: SessionOrchestratorState }
  | { step: 'post_test' };

export function resolveResearchGateStep(
  status: ResearchHydrationStatus,
  snapshot: ResearchSnapshot | null,
): ResearchGateStep {
  if (status === 'idle' || status === 'hydrating') {
    return { step: 'hydrating' };
  }

  if (status === 'unavailable') {
    return { step: 'unavailable' };
  }

  if (snapshot === null) {
    return { step: 'consent' };
  }

  const enrollment = snapshot.enrollment;

  if (enrollment === null || enrollment.consent_status !== 'consented') {
    return { step: 'consent' };
  }

  const phase = snapshot.workflow.phase;

  if (phase === 'NOT_STARTED') {
    return { step: 'entry' };
  }

  if (phase === 'DOMAIN_DISCOVERY') {
    const screening = snapshot.screening;
    if (screening === null || screening.status === 'pending') {
      return { step: 'screening' };
    }
    if (screening.status === 'not_eligible') {
      return { step: 'not_eligible' };
    }
    return { step: 'domain_discovery' };
  }

  if (phase === 'DOMAIN_CONFIRMED') {
    return { step: 'baseline_intro' };
  }

  if (phase === 'BASELINE_PENDING') {
    return { step: 'baseline_pending' };
  }

  if (phase === 'BASELINE_COMPLETED') {
    return { step: 'sessions_entry' };
  }

  const session = snapshot.session;
  if (session.sessionPhase === 'NOT_STARTED') {
    return session.currentSessionNumber === 1
      ? { step: 'sessions_entry' }
      : { step: 'session_next' };
  }
  if (session.sessionPhase === 'COMPLETED') {
    return session.currentSessionNumber === 3
      ? { step: 'post_test' }
      : { step: 'session_next' };
  }

  return { step: 'session_active', session };
}