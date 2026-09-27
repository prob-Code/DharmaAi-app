import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { researchCopy } from './researchContent';
import { ResearchButton } from './ResearchButton';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

interface Props {
  onFinish?: () => void;
  researchCode?: string | null;
  loading?: boolean;
  testID?: string;
}

export const CompletionScreen: React.FC<Props> = ({
  onFinish,
  researchCode,
  loading = false,
  testID,
}) => {
  const copy = researchCopy.completion;

  return (
    <SectionContainer
      testID={testID}
      scroll={false}
      centered
      footer={
        onFinish ? (
          <View style={styles.footer}>
            <ResearchButton
              label={copy.continueLabel}
              onPress={onFinish}
              loading={loading}
              disabled={loading}
            />
          </View>
        ) : undefined
      }
    >
      <ScreenHeader eyebrow={copy.eyebrow} title={copy.title} />

      <View style={styles.statement}>
        <Text style={styles.statementText} maxFontSizeMultiplier={1.2}>
          {copy.body}
        </Text>
      </View>

      {researchCode ? (
        <View style={styles.researchCode}>
          <Text style={styles.researchCodeLabel} maxFontSizeMultiplier={1.2}>
            {copy.researchCodeLabel}
          </Text>
          <Text style={styles.researchCodeValue} maxFontSizeMultiplier={1.2}>
            {researchCode}
          </Text>
          <Text style={styles.researchCodeNote} maxFontSizeMultiplier={1.2}>
            {copy.researchCodeNote}
          </Text>
        </View>
      ) : null}
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  statement: {
    borderLeftWidth: 2,
    borderLeftColor: researchPalette.accent,
    paddingLeft: 20,
  },
  statementText: {
    fontSize: 17,
    lineHeight: 28,
    color: researchPalette.muted,
  },
  researchCode: {
    alignItems: 'center',
    gap: 6,
  },
  researchCodeLabel: {
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: researchPalette.muted,
  },
  researchCodeValue: {
    fontSize: 20,
    letterSpacing: 2,
    color: researchPalette.accent,
  },
  researchCodeNote: {
    fontSize: 14,
    lineHeight: 22,
    color: researchPalette.muted,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  footer: {
    gap: 6,
  },
});