import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { researchCopy } from './researchContent';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

interface Props {
  testID?: string;
}

// Shown while the screening response is awaiting review. No action — the
// parent gate re-resolves from controller state once the review completes.
export const ScreeningPendingScreen: React.FC<Props> = ({ testID }) => {
  const copy = researchCopy.screeningPending;

  return (
    <SectionContainer testID={testID} scroll centered>
      <ScreenHeader eyebrow={copy.eyebrow} title={copy.title} />

      <View style={styles.pendingRow} accessibilityRole="text">
        <View style={styles.pendingDot} />
        <View style={styles.pendingLine} />
        <View style={styles.pendingDot} />
      </View>

      <Text style={styles.body} maxFontSizeMultiplier={1.2}>
        {copy.body}
      </Text>
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  pendingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: researchPalette.accent,
  },
  pendingLine: {
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: researchPalette.accentSoft,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    color: researchPalette.muted,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
});