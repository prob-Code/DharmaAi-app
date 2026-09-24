import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LikertScale, type AnswerOption } from './AnswerControls';
import { ProgressIndicator } from './ProgressIndicator';
import { ResearchButton } from './ResearchButton';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

/** itemIndex (0-based) → selected scale value. */
export type QuestionnaireAnswers = Record<number, string>;

interface Props {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** Participant-facing questions. */
  items: ReadonlyArray<string>;
  scale: ReadonlyArray<AnswerOption>;
  answers: Readonly<QuestionnaireAnswers>;
  onAnswer: (itemIndex: number, value: string) => void;
  onSubmit: (answers: QuestionnaireAnswers) => void;
  submitLabel?: string;
  progressLabel?: (current: number, total: number) => string;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

// Reusable questionnaire surface. Used by ADSS screening and by the
// baseline / post-test assessments. Presentational only — no scoring.
export const QuestionnaireScreen: React.FC<Props> = ({
  title,
  subtitle,
  eyebrow,
  items,
  scale,
  answers,
  onAnswer,
  onSubmit,
  submitLabel = 'Continue',
  progressLabel,
  loading = false,
  error = null,
  testID,
}) => {
  const answeredCount = items.reduce(
    (count, _, index) => count + (answers[index] ? 1 : 0),
    0,
  );
  const allAnswered = items.length > 0 && answeredCount === items.length;
  const label = progressLabel
    ? progressLabel(answeredCount, items.length)
    : `${answeredCount} of ${items.length}`;

  return (
    <SectionContainer
      testID={testID}
      scroll
      footer={
        <View style={styles.footer}>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <ResearchButton
            label={submitLabel}
            onPress={() => onSubmit({ ...answers })}
            disabled={!allAnswered || loading}
            loading={loading}
            accessibilityLabel={
              allAnswered ? submitLabel : `${submitLabel}. ${items.length - answeredCount} remaining`
            }
          />
        </View>
      }
    >
      <ScreenHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />

      <ProgressIndicator current={answeredCount} total={items.length} label={label} />

      <View style={styles.items}>
        {items.map((item, index) => (
          <View key={item} style={styles.itemBlock}>
            <View style={styles.itemHeading}>
              <Text style={styles.itemMarker}>{index + 1}</Text>
              <Text style={styles.itemText} maxFontSizeMultiplier={1.2}>
                {item}
              </Text>
            </View>
            <LikertScale
              options={scale}
              selected={answers[index] ?? null}
              onSelect={(value) => onAnswer(index, value)}
              accessibilityLabelPrefix={`Question ${index + 1}`}
            />
          </View>
        ))}
      </View>
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  items: {
    gap: 26,
  },
  itemBlock: {
    gap: 14,
  },
  itemHeading: {
    flexDirection: 'row',
    gap: 12,
  },
  itemMarker: {
    fontSize: 12,
    lineHeight: 24,
    color: researchPalette.faint,
    fontVariant: ['tabular-nums'],
    minWidth: 18,
    textAlign: 'right',
  },
  itemText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 26,
    color: researchPalette.text,
  },
  footer: {
    gap: 6,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: researchPalette.danger,
  },
});