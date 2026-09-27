import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { researchCopy } from './researchContent';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

interface Props {
  testID?: string;
}

// Calm resting state shown while a session is closing or a guard is pending.
// No action — the gate resumes from controller state when it is ready.
export const SessionLockedScreen: React.FC<Props> = ({ testID }) => {
  const copy = researchCopy.sessionLocked;

  return (
    <SectionContainer testID={testID} scroll centered>
      <ScreenHeader eyebrow={copy.eyebrow} title={copy.title} />

      <Text style={styles.body} maxFontSizeMultiplier={1.2}>
        {copy.body}
      </Text>
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  body: {
    fontSize: 16,
    lineHeight: 26,
    color: researchPalette.muted,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
});