import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { researchCopy } from './researchContent';
import { ResearchButton } from './ResearchButton';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { displayFont, researchPalette } from './researchTheme';

interface Props {
  sessionNumber: 1 | 2 | 3;
  onBegin: () => void;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

export const SessionTransitionScreen: React.FC<Props> = ({
  sessionNumber,
  onBegin,
  loading = false,
  error = null,
  testID,
}) => {
  const copy = researchCopy.sessions;
  const themes = copy.themes;
  const theme = themes[sessionNumber - 1];
  const sessionIndex = sessionNumber - 1;

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
            label={copy.beginLabel}
            onPress={onBegin}
            loading={loading}
            disabled={loading}
          />
        </View>
      }
    >
      <ScreenHeader eyebrow={copy.eyebrow} title={theme.heading} />

      {/* Continuity rail — words, not raw session state. */}
      <View
        style={styles.rail}
        accessibilityLabel={`${sessionNumber} of ${themes.length}`}
      >
        {themes.map((step, index) => {
          const isDone = index < sessionIndex;
          const isCurrent = index === sessionIndex;
          return (
            <React.Fragment key={step.marker}>
              {index > 0 ? (
                <View
                  style={[
                    styles.connector,
                    (isDone || isCurrent) && styles.connectorReached,
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.step,
                  (isDone || isCurrent) && styles.stepReached,
                ]}
                accessibilityElementsHidden={!isCurrent}
              >
                <View
                  style={[
                    styles.dot,
                    isDone && styles.dotDone,
                    isCurrent && styles.dotCurrent,
                  ]}
                />
                <Text
                  style={[
                    styles.markerLabel,
                    (isDone || isCurrent) && styles.markerLabelStrong,
                  ]}
                >
                  {step.marker}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      <Text style={styles.body} maxFontSizeMultiplier={1.2}>
        {theme.body}
      </Text>

      <Text style={styles.quietNote} maxFontSizeMultiplier={1.15}>
        There is no hurry here. Settle in when you are ready.
      </Text>
    </SectionContainer>
  );
};

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  step: {
    alignItems: 'center',
    gap: 8,
    opacity: 0.4,
  },
  stepReached: {
    opacity: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: researchPalette.borderStrong,
  },
  dotDone: {
    backgroundColor: researchPalette.faint,
  },
  dotCurrent: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: researchPalette.accent,
  },
  markerLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: researchPalette.muted,
  },
  markerLabelStrong: {
    color: researchPalette.text,
  },
  connector: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: researchPalette.surfaceRaised,
    alignSelf: 'center',
    marginBottom: 22,
    maxWidth: 44,
  },
  connectorReached: {
    backgroundColor: researchPalette.faint,
  },
  body: {
    fontSize: 18,
    lineHeight: 29,
    color: researchPalette.text,
    textAlign: 'center',
    fontFamily: displayFont,
  },
  quietNote: {
    fontSize: 14,
    lineHeight: 22,
    color: researchPalette.muted,
    textAlign: 'center',
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