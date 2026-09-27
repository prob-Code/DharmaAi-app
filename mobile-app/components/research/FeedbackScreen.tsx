import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LikertScale } from './AnswerControls';
import { researchCopy } from './researchContent';
import { ResearchButton } from './ResearchButton';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

export interface FeedbackInput {
  /** category id → selected scale value. */
  ratings: Readonly<Record<string, string>>;
  comment?: string;
}

interface Props {
  onSubmit: (input: FeedbackInput) => void;
  /** Calm note shown instead of the submit button when the submission
   *  builder is not yet wired by the parent. Presentational only. */
  actionNote?: string;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

export const FeedbackScreen: React.FC<Props> = ({
  onSubmit,
  actionNote,
  loading = false,
  error = null,
  testID,
}) => {
  const copy = researchCopy.feedback;
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');

  const allAnswered = copy.categories.every((category) => ratings[category.id]);

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
          {actionNote ? (
            <Text style={styles.actionNote} accessibilityRole="text">
              {actionNote}
            </Text>
          ) : (
            <ResearchButton
              label={copy.submitLabel}
              onPress={() =>
                onSubmit({ ratings: { ...ratings }, comment: comment.trim() || undefined })
              }
              disabled={!allAnswered || loading}
              loading={loading}
            />
          )}
        </View>
      }
    >
      <ScreenHeader eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />

      <View style={styles.categories}>
        {copy.categories.map((category) => (
          <View key={category.id} style={styles.categoryBlock}>
            <Text style={styles.categoryLabel} maxFontSizeMultiplier={1.2}>
              {category.label}
            </Text>
            <LikertScale
              options={copy.scale}
              selected={ratings[category.id] ?? null}
              onSelect={(value) =>
                setRatings((prev) => ({ ...prev, [category.id]: value }))
              }
              accessibilityLabelPrefix={category.label}
            />
          </View>
        ))}
      </View>

      <View style={styles.commentBlock}>
        <View style={styles.commentHeading}>
          <Text style={styles.commentLabel} maxFontSizeMultiplier={1.2}>
            {copy.commentLabel}
          </Text>
          <Text style={styles.commentOptional}>{copy.commentOptional}</Text>
        </View>
        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder={copy.commentPlaceholder}
          placeholderTextColor={researchPalette.faint}
          multiline
          maxLength={600}
          accessibilityLabel={copy.commentLabel}
        />
      </View>
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  categories: {
    gap: 26,
  },
  categoryBlock: {
    gap: 14,
  },
  categoryLabel: {
    fontSize: 17,
    lineHeight: 25,
    color: researchPalette.text,
    fontWeight: '500',
  },
  commentBlock: {
    gap: 12,
  },
  commentHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentLabel: {
    fontSize: 17,
    lineHeight: 25,
    color: researchPalette.text,
    fontWeight: '500',
  },
  commentOptional: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: researchPalette.faint,
  },
  commentInput: {
    minHeight: 96,
    maxHeight: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: researchPalette.border,
    backgroundColor: researchPalette.surface,
    color: researchPalette.text,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlignVertical: 'top',
  },
  footer: {
    gap: 6,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: researchPalette.danger,
  },
  actionNote: {
    fontSize: 14,
    lineHeight: 21,
    color: researchPalette.faint,
    textAlign: 'center',
    paddingVertical: 4,
  },
});