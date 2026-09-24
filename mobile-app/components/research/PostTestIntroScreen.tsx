import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { researchCopy } from './researchContent';
import { ResearchButton } from './ResearchButton';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

interface Props {
  onBegin: () => void;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

// Introduction to the post-intervention self-report. The questionnaire itself
// is rendered by the gate via QuestionnaireScreen once the participant
// proceeds — no protocol transition is implied here.
export const PostTestIntroScreen: React.FC<Props> = ({
  onBegin,
  loading = false,
  error = null,
  testID,
}) => {
  const copy = researchCopy.postTest;

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
            label={copy.continueLabel}
            onPress={onBegin}
            disabled={loading}
            loading={loading}
          />
        </View>
      }
    >
      <ScreenHeader eyebrow={copy.eyebrow} title={copy.title} />

      <Text style={styles.body} maxFontSizeMultiplier={1.2}>
        {copy.body}
      </Text>
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  body: {
    fontSize: 17,
    lineHeight: 27,
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