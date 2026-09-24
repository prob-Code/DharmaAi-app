import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { researchCopy } from './researchContent';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

interface Props {
  testID?: string;
}

// Screening completed, outcome not_eligible. Calm, non-clinical, no action.
export const NotEligibleScreen: React.FC<Props> = ({ testID }) => {
  const copy = researchCopy.notEligible;

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