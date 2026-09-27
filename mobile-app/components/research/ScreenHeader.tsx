import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { displayFont, researchPalette } from './researchTheme';

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  testID?: string;
}

// Quiet section heading used at the top of research surfaces.
export const ScreenHeader: React.FC<Props> = ({
  eyebrow,
  title,
  subtitle,
  testID,
}) => {
  return (
    <View style={styles.container} testID={testID}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text
        style={styles.title}
        accessibilityRole="header"
        maxFontSizeMultiplier={1.25}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    gap: 14,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: researchPalette.accent,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '600',
    fontFamily: displayFont,
    color: researchPalette.text,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 25,
    color: researchPalette.muted,
    textAlign: 'left',
  },
});