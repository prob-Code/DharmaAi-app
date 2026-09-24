import React from 'react';
import type { AnswerOption } from './AnswerControls';
import {
  QuestionnaireScreen,
  type QuestionnaireAnswers,
} from './QuestionnaireScreen';
import { researchCopy } from './researchContent';

interface Props {
  /**
   * Optional override for the instrument items. When omitted, the
   * configurable ADSS defaults are used. The research team owns the
   * authoritative instrument content.
   */
  items?: ReadonlyArray<string>;
  scale?: ReadonlyArray<AnswerOption>;
  answers: Readonly<QuestionnaireAnswers>;
  onAnswer: (itemIndex: number, value: string) => void;
  onSubmit: (answers: QuestionnaireAnswers) => void;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

// ADSS screening surface. Screening and identification only — presentational,
// never scoring.
export const AdssScreen: React.FC<Props> = ({
  items,
  scale,
  answers,
  onAnswer,
  onSubmit,
  loading,
  error,
  testID,
}) => {
  const copy = researchCopy.adss;

  return (
    <QuestionnaireScreen
      testID={testID}
      title={copy.title}
      subtitle={copy.subtitle}
      eyebrow={copy.eyebrow}
      items={items ?? copy.items}
      scale={scale ?? copy.scale}
      answers={answers}
      onAnswer={onAnswer}
      onSubmit={onSubmit}
      submitLabel={copy.submitLabel}
      progressLabel={copy.progressLabel}
      loading={loading}
      error={error}
    />
  );
};