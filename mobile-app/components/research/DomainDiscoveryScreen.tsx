import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { researchCopy } from './researchContent';
import { ResearchButton } from './ResearchButton';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

interface Props {
  /** Parent-supplied action that leads into the guided discovery
   *  conversation with the Companion. */
  onContinue: () => void;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

export const DomainDiscoveryScreen: React.FC<Props> = ({
  onContinue,
  loading = false,
  error = null,
  testID,
}) => {
  const copy = researchCopy.domainDiscovery;

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