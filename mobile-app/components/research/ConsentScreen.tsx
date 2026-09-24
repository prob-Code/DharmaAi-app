import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { researchCopy } from './researchContent';
import { ResearchButton } from './ResearchButton';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

interface Props {
  accepted: boolean;
  onAcceptChange: (accepted: boolean) => void;
  onContinue: () => void;
  loading?: boolean;
  error?: string | null;
  onDecline?: () => void;
  testID?: string;
}

export const ConsentScreen: React.FC<Props> = ({
  accepted,
  onAcceptChange,
  onContinue,
  loading = false,
  error = null,
  onDecline,
  testID,
}) => {
  const copy = researchCopy.consent;

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
            label={copy.continue}
            onPress={onContinue}
            disabled={!accepted || loading}
            loading={loading}
            accessibilityLabel={`${copy.continue}. ${
              accepted ? '' : copy.acknowledge
            }`}
          />
          {onDecline ? (
            <ResearchButton
              label={copy.decline}
              variant="ghost"
              onPress={onDecline}
              disabled={loading}
            />
          ) : null}
        </View>
      }
    >
      <ScreenHeader eyebrow={copy.eyebrow} title={copy.title} />

      <Text style={styles.summary} maxFontSizeMultiplier={1.2}>
        {copy.summary}
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

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={copy.acknowledge}
        accessibilityState={{ checked: accepted }}
        onPress={() => onAcceptChange(!accepted)}
        style={({ pressed }) => [
          styles.ackRow,
          accepted && styles.ackRowSelected,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.ackBox, accepted && styles.ackBoxSelected]}>
          {accepted ? <View style={styles.ackCheck} /> : null}
        </View>
        <Text
          style={[
            styles.ackLabel,
            accepted && styles.ackLabelSelected,
          ]}
        >
          {copy.acknowledge}
        </Text>
      </Pressable>
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  summary: {
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
  ackRow: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: researchPalette.border,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ackRowSelected: {
    borderColor: researchPalette.accent,
    backgroundColor: researchPalette.accentSoft,
  },
  ackBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: researchPalette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ackBoxSelected: {
    borderColor: researchPalette.accent,
  },
  ackCheck: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: researchPalette.accent,
  },
  ackLabel: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: researchPalette.muted,
    fontWeight: '500',
  },
  ackLabelSelected: {
    color: researchPalette.text,
  },
  pressed: {
    opacity: 0.7,
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