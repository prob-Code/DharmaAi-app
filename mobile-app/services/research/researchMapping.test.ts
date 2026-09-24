import { DEFAULT_CONVERSATION_STATE } from '../companion/conversationState';
import {
  DEFAULT_SESSION_ORCHESTRATOR_STATE,
  SESSION_PURPOSES,
} from '../companion/sessionOrchestrator';
import { createInitialSessionSummary } from '../companion/sessionSummary';
import {
  assessmentRowToBaselineAssessment,
  assessmentSubmissionToBaselineRecord,
  createDefaultSessionState,
  enrollmentRowToDomainDiscovery,
  enrollmentRowToWorkflow,
  serializeSessionSummary,
  sessionRowToOrchestratorState,
} from './researchMapping';
import {
  makeAssessmentRow,
  makeBaselineSubmission,
  makeEnrollmentRow,
  makeSessionRow,
} from './researchTestHarness';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function runResearchMappingTests(): void {
  const baselineRow = makeAssessmentRow();
  const domain = 'work-life balance';

  // enrollmentRowToWorkflow
  const confirmedEnrollment = makeEnrollmentRow({
    workflow_phase: 'DOMAIN_CONFIRMED',
    confirmed_domain: domain,
  });
  const workflow = enrollmentRowToWorkflow(confirmedEnrollment);
  assert(workflow.phase === 'DOMAIN_CONFIRMED', 'workflow phase should map from enrollment');
  assert(workflow.confirmedResearchDomain === domain, 'confirmed domain should map from enrollment');
  assert(workflow.baselineAssessment === null, 'workflow start should carry no baseline record');

  // enrollmentRowToDomainDiscovery
  const notStarted = enrollmentRowToDomainDiscovery(
    makeEnrollmentRow({ workflow_phase: 'NOT_STARTED' }),
  );
  assert(notStarted.status === 'NOT_STARTED', 'unstarted enrollment should map to NOT_STARTED discovery');
  assert(notStarted.fixedResearchDomain === null, 'unstarted discovery should have no fixed domain');

  const discovering = enrollmentRowToDomainDiscovery(
    makeEnrollmentRow({ workflow_phase: 'DOMAIN_DISCOVERY' }),
  );
  assert(discovering.status === 'EXPLORING', 'discovering enrollment should map to EXPLORING');

  const confirmedDiscovery = enrollmentRowToDomainDiscovery(confirmedEnrollment);
  assert(confirmedDiscovery.status === 'CONFIRMED', 'confirmed enrollment should map to CONFIRMED discovery');
  assert(
    confirmedDiscovery.fixedResearchDomain === domain,
    'confirmed discovery should freeze the domain',
  );
  assert(
    confirmedDiscovery.participantConfirmation === 'CONFIRMED',
    'confirmed discovery should carry participant confirmation',
  );

  // assessmentRowToBaselineAssessment
  const baseline = assessmentRowToBaselineAssessment(baselineRow);
  assert(baseline !== null, 'pre assessment row should map to a baseline record');
  assert(baseline?.instrumentId === 'baseline-pre', 'baseline record should map the instrument id');
  assert(
    baseline?.instrumentVersion === baselineRow.instrument_version,
    'baseline record should map the instrument version',
  );
  assert(baseline?.researchDomain === baselineRow.domain, 'baseline record should map the domain');
  assert(baseline?.role === 'pre', 'baseline record role should be pre');

  assert(
    assessmentRowToBaselineAssessment({ ...baselineRow, role: 'post' }) === null,
    'post assessment row should not map to a baseline record',
  );

  // assessmentSubmissionToBaselineRecord
  const submission = makeBaselineSubmission();
  const baselineRecord = assessmentSubmissionToBaselineRecord(submission);
  assert(baselineRecord.role === 'pre', 'baseline record role should be pre');
  assert(
    baselineRecord.researchDomain === submission.domain,
    'baseline record should carry the domain',
  );
  assert(baselineRecord.instrumentId === submission.instrument_id, 'baseline record should carry the instrument id');
  assert(
    baselineRecord.instrumentVersion === submission.instrument_version,
    'baseline record should carry the instrument version',
  );
  assert(baselineRecord.completedAt === submission.completed_at, 'baseline record should carry the completion time');
  assert('score' in submission === false, 'a participant submission must not carry a score field');

  // sessionRowToOrchestratorState
  const summary = createInitialSessionSummary({
    sessionNumber: 1,
    researchDomain: domain,
    keyConcerns: ['stress at work'],
  });
  const completedSessionRow = makeSessionRow({
    session_number: 2,
    status: 'COMPLETED',
    domain_snapshot: domain,
    summary,
  });
  const sessionState = sessionRowToOrchestratorState(completedSessionRow);
  assert(sessionState.currentSessionNumber === 2, 'session state should carry the reconstructed session number');
  assert(sessionState.sessionPhase === 'COMPLETED', 'session state should carry the reconstructed phase');
  assert(
    sessionState.sessionObjective === SESSION_PURPOSES[2],
    'session state should carry the reconstructed objective',
  );
  assert(
    sessionState.conversationState.sessionNumber === 2,
    'session conversation should carry the reconstructed session number',
  );
  assert(
    sessionState.conversationState.researchDomain === domain,
    'session conversation should carry the frozen research domain',
  );
  assert(
    sessionState.activeSummary?.keyConcerns[0] === 'stress at work',
    'session state should carry the persisted summary',
  );

  const unstartedSessionState = sessionRowToOrchestratorState(
    makeSessionRow({ session_number: 1, status: 'NOT_STARTED', domain_snapshot: null }),
  );
  assert(unstartedSessionState.activeSummary === null, 'unstarted session should have no summary');
  assert(
    unstartedSessionState.conversationState.researchDomain === null,
    'unstarted session should have no research domain',
  );

  // serializeSessionSummary
  const source = createInitialSessionSummary({
    keyConcerns: ['a', 'b'],
    importantThemes: ['c'],
    sensitiveContextPresent: true,
  });
  const serialized = serializeSessionSummary(source);
  serialized.keyConcerns.push('mutated');
  assert(source.keyConcerns.length === 2, 'serialized summary should not share arrays with the source');
  assert(serialized.sensitiveContextPresent === true, 'serialized summary should preserve scalar fields');
  assert(serialized.keyConcerns[2] === 'mutated', 'serialized summary arrays should be independent');

  // createDefaultSessionState
  const defaultState = createDefaultSessionState();
  assert(
    defaultState.conversationState !== DEFAULT_SESSION_ORCHESTRATOR_STATE.conversationState,
    'default session state should not share the conversation object',
  );
  defaultState.conversationState.openness = 0.99;
  assert(
    DEFAULT_CONVERSATION_STATE.openness === 0.5,
    'mutating a default session state should not touch the shared default conversation',
  );
}

runResearchMappingTests();
console.log('researchMapping tests passed');