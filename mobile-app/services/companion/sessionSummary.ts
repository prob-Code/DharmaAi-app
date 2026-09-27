import type { ResearchDomain } from './conversationState';

export type SessionSummaryField = string;

export interface SessionSummary {
  sessionNumber: number;
  researchDomain: ResearchDomain;
  keyConcerns: SessionSummaryField[];
  importantThemes: SessionSummaryField[];
  participantStatedGoals: SessionSummaryField[];
  usefulReflections: SessionSummaryField[];
  unresolvedTopics: SessionSummaryField[];
  interactionPreferences: SessionSummaryField[];
  sensitiveContextPresent: boolean;
  closureNotes: SessionSummaryField[];
}

export const DEFAULT_SESSION_SUMMARY: SessionSummary = {
  sessionNumber: 1,
  researchDomain: null,
  keyConcerns: [],
  importantThemes: [],
  participantStatedGoals: [],
  usefulReflections: [],
  unresolvedTopics: [],
  interactionPreferences: [],
  sensitiveContextPresent: false,
  closureNotes: [],
};

export function createInitialSessionSummary(
  overrides: Partial<SessionSummary> = {},
): SessionSummary {
  return {
    ...DEFAULT_SESSION_SUMMARY,
    ...overrides,
  };
}

export function addUniqueEntries<T extends string>(
  values: T[],
  entries: T[],
): T[] {
  const next = [...values];

  for (const entry of entries) {
    if (entry.trim().length === 0) {
      continue;
    }

    if (!next.includes(entry)) {
      next.push(entry);
    }
  }

  return next;
}
