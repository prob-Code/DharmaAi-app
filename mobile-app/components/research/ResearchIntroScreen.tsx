import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { researchCopy } from './researchContent';
import { ResearchButton } from './ResearchButton';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

interface Props {
  onContinue: () => void;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

export const ResearchIntroScreen: React.FC<Props> = ({
  onContinue,
  loading = false,
  error = null,
  testID,
}) => {
  const copy = researchCopy.introduction;

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
            onPress={onContinue}
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

      <View style={styles.points}>
        {copy.points.map((point) => (
          <View key={point} style={styles.pointRow}>
            <View style={styles.pointDot} />
            <Text style={styles.pointText} maxFontSizeMultiplier={1.2}>
              {point}
            </Text>
          </View>
        ))}
      </View>
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  body: {
    fontSize: 17,
    lineHeight: 27,
    color: researchPalette.text,
  },
  points: {
    gap: 14,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: researchPalette.accent,
    marginTop: 9,
  },
  pointText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    color: researchPalette.muted,
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