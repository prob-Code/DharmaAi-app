import type { ResearchSnapshot } from '../../services/research/researchController';
import {
  resolveResearchGateStep,
  type ResearchGateStep,
} from '../../services/research/researchGate';

// Presentation adapter over the engineering research gate.
//
// PROTOCOL TRUTH: all step resolution is delegated to the single engineering
// resolver in services/research/researchGate.ts. This file never re-decides
// protocol state — it only translates a resolved ResearchGateStep into the
// finer presentation stage the UI renders, splitting coarse steps on
// presentation grounds only.
//
// ResearchHydrationStatus is kept here as the local mirror of the engineering
// useParticipantResearch type so the UI layer stays decoupled from the
// primary-owned hook until merge.

export type ResearchHydrationStatus = 'idle' | 'hydrating' | 'ready' | 'unavailable';

export type ParticipantStage =
  | { stage: 'hydrating' }
  | { stage: 'unavailable' }
  | { stage: 'consent' }
  | { stage: 'introduction' }
  | { stage: 'screening' }
  | { stage: 'screening_pending' }
  | { stage: 'not_eligible' }
  | { stage: 'domain_discovery' }
  | { stage: 'domain_confirmation'; scenario: string }
  | { stage: 'baseline_intro' }
  | { stage: 'baseline' }
  | { stage: 'session_entry' }
  | { stage: 'session_transition'; sessionNumber: 1 | 2 | 3 }
  | { stage: 'session_locked' }
  | { stage: 'session_active' }
  | { stage: 'post_test_intro' }
  | { stage: 'post_test' };

export function resolveParticipantStage(
  status: ResearchHydrationStatus,
  snapshot: ResearchSnapshot | null,
): ParticipantStage {
  // Single source of protocol truth — the vendored engineering gate.
  const step = resolveResearchGateStep(status, snapshot);
  return refinePresentation(step, snapshot);
}

function refinePresentation(
  step: ResearchGateStep,
  snapshot: ResearchSnapshot | null,
): ParticipantStage {
  switch (step.step) {
    case 'hydrating':
      return { stage: 'hydrating' };
    case 'unavailable':
      return { stage: 'unavailable' };
    case 'consent':
      return { stage: 'consent' };
    case 'entry':
      return { stage: 'introduction' };
    case 'not_eligible':
      return { stage: 'not_eligible' };
    case 'baseline_intro':
      return { stage: 'baseline_intro' };
    case 'baseline_pending':
      return { stage: 'baseline' };
    case 'sessions_entry':
      return { stage: 'session_entry' };
    case 'post_test':
      return { stage: 'post_test_intro' };
    case 'screening':
      // Presentation split only: the gate yields 'screening' for both a
      // missing review and one awaiting resolution.
      return snapshot?.screening && snapshot.screening.status === 'pending'
        ? { stage: 'screening_pending' }
        : { stage: 'screening' };
    case 'domain_discovery':
      // Presentation split only: highlight the candidate the companion
      // surfaced, using the participant-facing scenario (never a domain id).
      return snapshot?.domainDiscovery.status === 'AWAITING_CONFIRMATION' ||
        snapshot?.domainDiscovery.status === 'CANDIDATE_PRESENTED'
        ? {
            stage: 'domain_confirmation',
            scenario: snapshot.domainDiscovery.participantFacingScenario,
          }
        : { stage: 'domain_discovery' };
    case 'session_active':
      // Presentation split only: a session in CLOSING pauses quietly rather
      // than re-opening the active surface.
      return snapshot?.session.sessionPhase === 'CLOSING'
        ? { stage: 'session_locked' }
        : { stage: 'session_active' };
    case 'session_next':
      // Presentation split only: surface the number of the session about to
      // begin for the transition wording.
      return {
        stage: 'session_transition',
        sessionNumber: nextSessionNumber(snapshot),
      };
    default:
      return { stage: 'session_active' };
  }
}

function nextSessionNumber(snapshot: ResearchSnapshot | null): 1 | 2 | 3 {
  const current = snapshot?.session.currentSessionNumber ?? 1;
  const next = snapshot?.session.sessionPhase === 'NOT_STARTED' ? current : current + 1;
  return Math.min(next, 3) as 1 | 2 | 3;
}