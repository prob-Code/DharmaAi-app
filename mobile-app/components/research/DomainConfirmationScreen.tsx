import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { researchCopy } from './researchContent';
import { ResearchButton } from './ResearchButton';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { displayFont, researchPalette } from './researchTheme';

interface Props {
  /** Participant-facing description of the chosen thread. No technical domain ids. */
  scenario: string;
  onConfirm: () => void;
  onReconsider: () => void;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

export const DomainConfirmationScreen: React.FC<Props> = ({
  scenario,
  onConfirm,
  onReconsider,
  loading = false,
  error = null,
  testID,
}) => {
  const copy = researchCopy.domainConfirmation;

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
            label={copy.confirmLabel}
            onPress={onConfirm}
            loading={loading}
            disabled={loading}
          />
          <ResearchButton
            label={copy.reconsiderLabel}
            variant="ghost"
            onPress={onReconsider}
            disabled={loading}
          />
        </View>
      }
    >
      <ScreenHeader eyebrow={copy.eyebrow} title={copy.title} />

      <View style={styles.statement}>
        <Text
          style={styles.statementText}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.2}
        >
          {scenario}
        </Text>
      </View>

      <Text style={styles.note} maxFontSizeMultiplier={1.2}>
        {copy.note}
      </Text>
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  statement: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: researchPalette.border,
    backgroundColor: researchPalette.surface,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  statementText: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '600',
    fontFamily: displayFont,
    color: researchPalette.text,
    textAlign: 'center',
  },
  note: {
    fontSize: 15,
    lineHeight: 24,
    color: researchPalette.muted,
    textAlign: 'center',
    paddingHorizontal: 8,
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