import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { researchCopy } from './researchContent';
import { ResearchButton } from './ResearchButton';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

interface Props {
  onFinish: () => void;
  loading?: boolean;
  testID?: string;
}

export const CompletionScreen: React.FC<Props> = ({
  onFinish,
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
        <View style={styles.footer}>
          <ResearchButton
            label={copy.continueLabel}
            onPress={onFinish}
            loading={loading}
            disabled={loading}
          />
        </View>
      }
    >
      <ScreenHeader eyebrow={copy.eyebrow} title={copy.title} />

      <View style={styles.statement}>
        <Text style={styles.statementText} maxFontSizeMultiplier={1.2}>
          {copy.body}
        </Text>
      </View>
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
  footer: {
    gap: 6,
  },
});