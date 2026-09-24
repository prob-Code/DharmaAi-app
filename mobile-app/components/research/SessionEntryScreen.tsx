import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { researchCopy } from './researchContent';
import { ResearchButton } from './ResearchButton';
import { ScreenHeader } from './ScreenHeader';
import { SectionContainer } from './SectionContainer';
import { researchPalette } from './researchTheme';

interface Props {
  onBegin: () => void;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

// Beginning of the three-session arc, before session one starts.
export const SessionEntryScreen: React.FC<Props> = ({
  onBegin,
  loading = false,
  error = null,
  testID,
}) => {
  const copy = researchCopy.sessionEntry;
  const themes = researchCopy.sessions.themes;

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
            onPress={onBegin}
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

      <View style={styles.themes}>
        {themes.map((theme) => (
          <View key={theme.marker} style={styles.themeBlock}>
            <Text style={styles.themeMarker}>{theme.marker}</Text>
            <View style={styles.themeTextBlock}>
              <Text style={styles.themeHeading} maxFontSizeMultiplier={1.2}>
                {theme.heading}
              </Text>
              <Text style={styles.themeBody} maxFontSizeMultiplier={1.2}>
                {theme.body}
              </Text>
            </View>
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
  themes: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: researchPalette.border,
    backgroundColor: researchPalette.surface,
    padding: 20,
    gap: 18,
  },
  themeBlock: {
    flexDirection: 'row',
    gap: 14,
  },
  themeMarker: {
    fontSize: 17,
    lineHeight: 24,
    color: researchPalette.accent,
    fontWeight: '600',
    minWidth: 42,
  },
  themeTextBlock: {
    flex: 1,
    gap: 3,
  },
  themeHeading: {
    fontSize: 16,
    lineHeight: 22,
    color: researchPalette.text,
    fontWeight: '500',
  },
  themeBody: {
    fontSize: 14,
    lineHeight: 21,
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